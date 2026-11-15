// Claudagotchi de escritorio. Una ventana transparente, sin bordes y siempre
// encima, a lo ancho de la parte de abajo de la pantalla (justo por encima de la
// barra de tareas), donde pasea la mascota.
//
// Los clics atraviesan la ventana salvo encima de la mascota y de su tarjeta: la
// interfaz nos manda esos rectángulos y aquí vigilamos el cursor para activar o
// desactivar el paso de clics. Los datos los da el mismo programa de terminal
// (claudagotchi json / accion), que viaja dentro de la app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_autostart::ManagerExt;

const WINDOW_H: f64 = 470.0; // alto lógico: cabe la tarjeta encima de la mascota

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Default)]
struct HitRects(Mutex<Vec<Rect>>);

#[derive(Clone, Serialize)]
struct CursorPos {
    x: f64,
    y: f64,
}

// ---------- El programa de terminal que viaja dentro ----------

fn sidecar() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().map(|p| p.to_path_buf()).unwrap_or_default();
    let name = if cfg!(windows) { "claudagotchi.exe" } else { "claudagotchi" };
    dir.join(name)
}

fn run(args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new(sidecar());
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: sin parpadeo de consola
    }
    let out = cmd.output().map_err(|e| format!("no se pudo ejecutar claudagotchi: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

// ---------- Comandos para la interfaz ----------

#[tauri::command]
async fn get_state() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| run(&["json"])).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn do_action(name: String, arg: Option<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut args = vec!["accion", name.as_str()];
        if let Some(a) = arg.as_deref() {
            args.push(a);
        }
        run(&args)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn set_hit_rects(rects: Vec<Rect>, state: tauri::State<HitRects>) {
    *state.0.lock().unwrap() = rects;
}

#[tauri::command]
fn open_full() {
    open_terminal();
}

fn open_terminal() {
    let bin = sidecar();
    let bin = bin.to_string_lossy().to_string();
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // Windows Terminal si está, si no la consola de siempre
        let wt = Command::new("wt").args(["-w", "new", &bin]).creation_flags(0x0800_0000).spawn();
        if wt.is_err() {
            let _ = Command::new("cmd").args(["/c", "start", "Claudagotchi", &bin]).creation_flags(0x0800_0000).spawn();
        }
    }
    #[cfg(target_os = "macos")]
    {
        let script = format!("tell application \"Terminal\" to do script \"'{}'\"\ntell application \"Terminal\" to activate", bin);
        let _ = Command::new("osascript").args(["-e", &script]).spawn();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        for term in ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"] {
            let r = if term == "gnome-terminal" { Command::new(term).args(["--", &bin]).spawn() } else { Command::new(term).args(["-e", &bin]).spawn() };
            if r.is_ok() {
                break;
            }
        }
    }
}

// ---------- Ventana: posición y paso de clics ----------

fn place_window(win: &WebviewWindow) {
    let Ok(Some(mon)) = win.primary_monitor() else { return };
    let scale = mon.scale_factor();
    let area = mon.work_area();
    let h = (WINDOW_H * scale) as u32;
    let _ = win.set_size(PhysicalSize::new(area.size.width, h));
    let _ = win.set_position(PhysicalPosition::new(area.position.x, area.position.y + area.size.height as i32 - h as i32));
}

fn watch_cursor(app: AppHandle) {
    std::thread::spawn(move || {
        let mut ignoring = true;
        std::thread::sleep(Duration::from_millis(500));
        let mut last = (f64::NAN, f64::NAN);
        loop {
            std::thread::sleep(Duration::from_millis(33));
            let Some(win) = app.get_webview_window("main") else { continue };
            if !win.is_visible().unwrap_or(false) {
                continue;
            }
            let (Ok(cur), Ok(pos), Ok(scale)) = (app.cursor_position(), win.outer_position(), win.scale_factor()) else { continue };
            let x = (cur.x - pos.x as f64) / scale;
            let y = (cur.y - pos.y as f64) / scale;
            let over = {
                let rects = app.state::<HitRects>();
                let rects = rects.0.lock().unwrap();
                rects.iter().any(|r| x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
            };
            if over == ignoring {
                ignoring = !over;
                let _ = win.set_ignore_cursor_events(ignoring);
            }
            if (x, y) != last {
                last = (x, y);
                let _ = app.emit("cursor", CursorPos { x, y });
            }
        }
    });
}

// ---------- Menú del icono junto al reloj ----------

fn widget_config(patch: serde_json::Value) {
    let _ = run(&["widget-config", &patch.to_string()]);
}

fn label(menu: &serde_json::Value, key: &str, fallback: &str) -> String {
    menu.get(key).and_then(|v| v.as_str()).unwrap_or(fallback).to_string()
}

fn build_tray(app: &AppHandle, state: &serde_json::Value) -> tauri::Result<()> {
    let menu_t = state.get("menu").cloned().unwrap_or_default();
    let widget = state.get("widget").cloned().unwrap_or_default();
    let scale = widget.get("scale").and_then(|v| v.as_f64()).unwrap_or(2.0) as i64;
    let badge = widget.get("showBadge").and_then(|v| v.as_bool()).unwrap_or(true);
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);

    let toggle = MenuItem::with_id(app, "toggle", label(&menu_t, "ocultar", "Ocultar mascota"), true, None::<&str>)?;
    let s2 = CheckMenuItem::with_id(app, "scale2", label(&menu_t, "pequena", "Pequeña"), true, scale == 2, None::<&str>)?;
    let s3 = CheckMenuItem::with_id(app, "scale3", label(&menu_t, "mediana", "Mediana"), true, scale == 3, None::<&str>)?;
    let s4 = CheckMenuItem::with_id(app, "scale4", label(&menu_t, "grande", "Grande"), true, scale == 4, None::<&str>)?;
    let size = Submenu::with_items(app, label(&menu_t, "tamano", "Tamaño"), true, &[&s2, &s3, &s4])?;
    let badge_i = CheckMenuItem::with_id(app, "badge", label(&menu_t, "porcentaje", "Mostrar el % siempre"), true, badge, None::<&str>)?;
    let auto_i = CheckMenuItem::with_id(app, "autostart", label(&menu_t, "arrancar", "Arrancar con el ordenador"), true, autostart, None::<&str>)?;
    let full = MenuItem::with_id(app, "full", label(&menu_t, "completa", "Abrir vista completa"), true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", label(&menu_t, "salir", "Salir"), true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&toggle, &sep, &size, &badge_i, &auto_i, &sep2, &full, &quit])?;

    let (shown, hidden) = (label(&menu_t, "ocultar", "Ocultar mascota"), label(&menu_t, "mostrar", "Mostrar mascota"));
    let scales = [(s2.clone(), 2), (s3.clone(), 3), (s4.clone(), 4)];
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().expect("icono"))
        .tooltip("Claudagotchi")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, ev| {
            let id = ev.id().as_ref();
            match id {
                "toggle" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let visible = w.is_visible().unwrap_or(true);
                        let _ = if visible { w.hide() } else { w.show() };
                        let _ = toggle.set_text(if visible { &hidden } else { &shown });
                    }
                }
                "scale2" | "scale3" | "scale4" => {
                    let n: i64 = id[5..].parse().unwrap_or(2);
                    for (item, v) in &scales {
                        let _ = item.set_checked(*v == n);
                    }
                    widget_config(serde_json::json!({ "scale": n }));
                    let _ = app.emit("config", serde_json::json!({ "scale": n }));
                }
                "badge" => {
                    let on = badge_i.is_checked().unwrap_or(true);
                    widget_config(serde_json::json!({ "showBadge": on }));
                    let _ = app.emit("config", serde_json::json!({ "showBadge": on }));
                }
                "autostart" => {
                    let al = app.autolaunch();
                    let _ = if auto_i.is_checked().unwrap_or(false) { al.enable() } else { al.disable() };
                }
                "full" => open_terminal(),
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Si ya está abierta, abrir otra solo la vuelve a enseñar
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
            }
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .manage(HitRects::default())
        .invoke_handler(tauri::generate_handler![get_state, do_action, set_hit_rects, open_full])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // sin icono en el Dock

            let handle = app.handle().clone();
            let state: serde_json::Value = run(&["json"]).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();

            // La primera vez se apunta para arrancar con el ordenador (se quita en el menú)
            let first_run = state.get("widget").and_then(|w| w.get("autostartSet")).is_none();
            if first_run {
                let _ = handle.autolaunch().enable();
                widget_config(serde_json::json!({ "autostartSet": true }));
            }
            build_tray(&handle, &state)?;

            if let Some(win) = app.get_webview_window("main") {
                place_window(&win);
                // Primero se enseña (en Linux la ventana tiene que existir de verdad
                // antes de poder dejar pasar los clics)
                let _ = win.show();
                let _ = win.set_ignore_cursor_events(true);
            }
            watch_cursor(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("no se pudo arrancar Claudagotchi");
}
