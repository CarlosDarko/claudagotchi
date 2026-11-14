// Castellano (idioma por defecto). Las claves con lista eligen una frase al azar.
export default {
  // Formato de fechas (código BCP 47)
  'locale': 'es-ES',

  // Nombres
  'names': ['Pixel', 'Tokki', 'Bitxo', 'Nube', 'Chispa', 'Bocadillo', 'Glitch', 'Mochi', 'Turrón', 'Lumen', 'Kiwi', 'Bytey', 'Pompón', 'Quark'],
  'stage': { huevo: 'Huevo', bebe: 'Bebé', nino: 'Peque', teen: 'Adolescente', adulto: 'Adulto', leyenda: 'Leyenda', nube: 'En la nube' },
  'form': { opus: 'Opusaurio', sonnet: 'Sonetín', haiku: 'Haikoi', fable: 'Fabulín', mixto: 'Quimerilla' },
  'variant': { brillante: ' brillante ✨', grunon: ' gruñón', normal: '' },
  'mood': {
    huevo: 'incubando', nube: 'en la nube', dormido: 'durmiendo', enfermo: 'enfermo', fuego: 'en llamas', hambriento: 'hambriento',
    sucio: 'sucio', trabajando: 'trabajando', cansado: 'cansado', triste: 'triste', feliz: 'feliz', normal: 'tranquilo',
  },
  'stat': { hambre: 'Hambre', felicidad: 'Felicidad', energia: 'Energía', salud: 'Salud', higiene: 'Higiene' },
  'tool': {
    leyendo: 'leyendo', buscando: 'buscando', editando: 'editando', escribiendo: 'escribiendo', ejecutando: 'ejecutando',
    investigando: 'investigando', delegando: 'delegando', planificando: 'planificando', herramientas: 'usando herramientas', trabajando: 'trabajando',
  },

  // Logros
  'ach': {
    eclosion: ['Ha nacido', 'Tu huevo eclosionó.'],
    'primer-bocado': ['Primer bocado', 'Comió sus primeros tokens.'],
    nino: ['Ya camina', 'Llegó a Peque.'],
    teen: ['Edad del pavo', 'Llegó a Adolescente.'],
    adulto: ['Mayor de edad', 'Evolucionó a su forma adulta.'],
    leyenda: ['Leyenda', '400M tokens y un cuidado de diez.'],
    millon: ['Millonario', 'Un día de más de 1M de tokens nuevos.'],
    'racha-7': ['Una semana juntos', '7 días seguidos programando.'],
    'racha-30': ['Inseparables', '30 días seguidos programando.'],
    limpito: ['Limpito', '10 limpiezas.'],
    jugon: ['Jugón', '10 partidas ganadas.'],
    zen: ['Zen', '5 descansos después de trabajar mucho rato.'],
    superviviente: ['Superviviente', 'Lo curaste de una enfermedad.'],
    noctambulo: ['Noctámbulo', 'Programando entre las 2 y las 5 de la mañana.'],
    madrugador: ['Madrugador', 'Programando antes de las 7.'],
    'al-limite': ['Al límite', 'Llegaste al 100 % de la sesión.'],
    reencarnacion: ['Otra vida', 'Adoptaste un huevo nuevo.'],
  },
  'ev.logro': '🏅 Logro: {name}. {desc}',

  // Lo que dice la mascota
  'ev.hiberno': 'Hiberné mientras no estabas ({dur}). ¡Ya estoy despierto!',
  'ev.comio': ['¡Ñam! Gracias por esos tokens.', 'Mmm, sabían a refactor.', 'Por fin comida de verdad.', 'Esos tokens estaban de vicio.'],
  'ev.caca': '💩 Ups. Alguien tendría que limpiar eso (l).',
  'ev.enfermo': '🤒 No me encuentro bien... ¿tienes medicina? (m)',
  'ev.muerte': '☁️ {name} se ha ido a la nube. Pulsa h (o ejecuta \'claudagotchi nuevo\') para adoptar otro huevo.',
  'ev.critico.hambre': 'Tengo hambre... Ponte a programar o dame un bocado (c).',
  'ev.critico.felicidad': 'Me aburro mucho. ¿Jugamos? (j)',
  'ev.critico.higiene': 'Esto huele fatal. Limpia, porfa (l).',
  'ev.critico.salud': 'Estoy muy malito. ¡Medicina (m), ya!',
  'ev.hola.noche': '¿Todavía despierto?',
  'ev.hola.manana': '¡Buenos días!',
  'ev.hola.tarde': '¡Buenas tardes!',
  'ev.hola.cena': '¡Buenas noches!',
  'ev.hola.ayer': ' Ayer me diste {tokens} tokens de comida.',
  'ev.hola.ayer0': ' Ayer no programamos nada, te eché de menos.',
  'ev.hola.racha': ' Llevamos {days} días seguidos.',
  'ev.hola.bocados': ' Toma 2 bocados.',
  'ev.ventana': '✨ ¡Ventana nueva! Vuelvo a tener toda la energía.',
  'ev.fuego': '🔥 ¡Me quemo! Sesión al {pct} %.',
  'ev.fuego.reset': ' Se reinicia en {dur}.',
  'ev.agotado': '😵 Agotado. Me echo a dormir hasta las {hora}.',
  'ev.agotado.sinhora': 'que se reinicie',
  'ev.descanso': '🧘 Bien hecho, ese descanso nos ha sentado genial a los dos.',
  'ev.estirar': 'Llevamos {dur} sin parar. ¿Estiramos las piernas? Un descanso de 15 min me cura.',
  'ev.eclosion': '🐣 ¡He nacido! Hola, soy {name}. Me alimento de los tokens que gastas con Claude.',
  'ev.evoluciona': '🌟 ¡{name} ha evolucionado a {label}!',
  'ev.huevo': '🥚 Un huevo nuevo. Generación {gen}. Se llamará {name}.',

  // Respuestas a acciones
  'act.muerto': 'Ya no está... pulsa h para adoptar otro huevo.',
  'act.huevo': 'Todavía es un huevo. Dale calor (y tokens).',
  'act.lleno': 'Está lleno. No le obligues.',
  'act.sinbocados': 'No te quedan bocados. Se ganan programando con Claude (1 cada 150k tokens).',
  'act.comer': ['¡Ñam ñam!', 'Rico, rico.', '¡Qué bueno estaba!'],
  'act.chuche': '🍬 ¡Una chuche! (no abuses, que engorda)',
  'act.yalimpio': 'Ya está todo limpio.',
  'act.limpiar': '🧽 ¡Limpito y oliendo a nuevo!',
  'act.sano': 'Está sano, no necesita medicina.',
  'act.espera': 'Acaba de tomarla. Espera {min} min.',
  'act.medicina': '💊 Puaj... pero ya me encuentro mejor.',
  'act.caricia': '❤️ ¡Me encanta!',
  'act.cosquillas': '¡Jeje, cosquillas!',
  'act.cansado': 'Está demasiado cansado para jugar.',
  'act.gana': '🎉 ¡Ganamos! {wins}/5 aciertos.',
  'act.pierde': 'Casi... {wins}/5. ¡Otra!',
  'act.luzon': '💡 ¡Buenos días!',
  'act.luzoff': '🌙 Buenas noches... zzz',
  'act.nose': 'No sé hacer eso.',

  // Statusline
  'sl.hoy': 'hoy',
  'sl.sinCuenta': 'sin %',
  'sl.reinicio': '↻{dur}',

  // Interfaz
  'ui.tabs': ['Mascota', 'Uso', 'Logros', 'Álbum'],
  'ui.edad': 'edad {dur}',
  'ui.gen': 'gen. {n}',
  'ui.bocados': '{n} bocados',
  'ui.comido': 'ha comido {tokens}',
  'ui.sesion': 'Sesión 5 h',
  'ui.semana': 'Semana',
  'ui.semanaSola': 'Semana (tu plan no tiene ventana de 5 h)',
  'ui.reinicia': 'se reinicia en {dur} ({hora})',
  'ui.caducada': 'lectura caducada, esperando dato nuevo',
  'ui.viejo': 'leído hace {dur}',
  'ui.sinCuenta': 'Sin % real: inicia sesión en Claude Code (claude /login) y lo leo de ahí.',
  'ui.ritmo.agota': '~{dur} hasta el límite a este ritmo',
  'ui.ritmo.llega': 'a este ritmo llegas al reinicio',
  'ui.ahora': 'Ahora',
  'ui.trabajando': '● {kind} · {rate}/min',
  'ui.reposo': '○ en reposo · hoy {tokens}',
  'ui.hoy': 'Hoy',
  'ui.tokens': '{tokens} tokens ({food} de comida)',
  'ui.racha': 'Racha',
  'ui.rachaDias': '{n} días',
  'ui.modelos7': 'Por modelo · 7 días',
  'ui.proyectos7': 'Por proyecto · 7 días',
  'ui.mapa30': 'Últimos 30 días · {tokens}',
  'ui.horas': 'Hoy por horas',
  'ui.sinDatos': 'Todavía no hay datos.',
  'ui.otros': 'otros',
  'ui.logros': 'Logros ({n}/{total})',
  'ui.album': 'Álbum de mascotas',
  'ui.albumVacio': 'Aún no se ha ido ninguna a la nube. Cuídala bien.',
  'ui.albumFila': '{name} · gen. {gen} · {stage} · vivió {dur} · comió {tokens}',
  'ui.teclas': '[c] comer [x] chuche [j] jugar [l] limpiar [m] medicina [a] acariciar [d] luces [tab] vista [q] salir',
  'ui.teclasNube': '[h] adoptar un huevo nuevo [tab] vista [q] salir',
  'ui.juego.titulo': '¿Hacia qué lado mirará {name}?',
  'ui.juego.ayuda': '← o → para elegir · ronda {r}/5 · aciertos {w}',
  'ui.juego.bien': '¡Acertaste!',
  'ui.juego.mal': 'Nooo, miró al otro lado.',
  'ui.pequena': 'Haz la terminal un poco más grande (mínimo 60×20).',
  'ui.diario': 'diario',

  // CLI
  'cli.ayuda': `claudagotchi: una mascota que vive de tu uso de Claude Code

Uso:
  claudagotchi                 abre la mascota (interfaz animada)
  claudagotchi instalar        la pone en la statusline de Claude Code
  claudagotchi desinstalar     la quita de la statusline
  claudagotchi estado          resumen en una línea
  claudagotchi nombre <nombre> le cambia el nombre
  claudagotchi nuevo [nombre]  adopta un huevo nuevo (la actual se jubila al álbum)
  claudagotchi idioma <código> cambia el idioma (disponibles: {langs})
  claudagotchi demo            pasea por todas las etapas y humores
  claudagotchi statusline      lo que llama Claude Code (lee JSON por stdin)

Datos en {dir}`,
  'cli.instalado': '✓ Listo. Claudagotchi vive ahora en tu statusline de Claude Code ({file}).',
  'cli.yaHabia': 'Ya tenías una statusline ({cmd}). La he guardado y la sustituyo. \'claudagotchi desinstalar\' la recupera.',
  'cli.desinstalado': '✓ Quitado de la statusline.',
  'cli.noInstalado': 'No estaba en la statusline.',
  'cli.renombrado': '✓ Ahora se llama {name}.',
  'cli.sinMascota': 'Todavía no hay mascota. Ejecuta \'claudagotchi\' para incubar el huevo.',
  'cli.idioma': '✓ Idioma: {lang}.',
  'cli.noTTY': 'La interfaz necesita una terminal interactiva. Prueba \'claudagotchi estado\'.',
}
