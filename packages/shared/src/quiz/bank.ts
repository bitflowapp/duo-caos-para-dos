/**
 * Banco original de preguntas de «¿Cuánto me conocés?».
 *
 * Pautas de contenido (las verificables se controlan en test/quizBank.test.ts):
 * - Español rioplatense con voseo; tono gracioso, juguetón y tierno.
 * - Sirve para cualquier pareja: no se suponen géneros. A la otra persona se la nombra
 *   con el marcador {name} (solo en `guess`) y se evitan adjetivos con género.
 * - Mazo 'romance': cariño, recuerdos y gestos; nunca explícito y siempre omitible.
 * - Nada de celos, ex, «quién quiere más», dinero, cuerpos, religión, política ni traumas.
 * - Enunciados de hasta 90 caracteres (con {name} reemplazado) y opciones de hasta 26.
 * - Los ids son estables: no reutilizarlos ni renombrarlos.
 */

export type QuizKind = 'predict' | 'whoMore' | 'telepathy';
export type QuizDeckId = 'light' | 'romance';

export interface QuizQuestion {
  /** Id estable y único, en kebab-case con prefijo: p- (predict), w- (whoMore), t- (telepathy). */
  id: string;
  kind: QuizKind;
  /** 'light' = humor, gustos, hipotéticas. 'romance' = cariño, recuerdos, gestos de pareja (siempre omitibles). */
  deck: QuizDeckId;
  /** predict: pregunta que la persona responde sobre sí misma, en segunda persona (voseo). */
  self?: string;
  /** predict: misma pregunta para quien adivina, usando {name} para la otra persona. */
  guess?: string;
  /** whoMore y telepathy: enunciado único que ven ambos. */
  text?: string;
  /** predict y telepathy: 3 o 4 opciones. whoMore: omitir (las opciones son los dos nombres). */
  options?: readonly string[];
}

interface PredictEntry {
  readonly id: string;
  readonly self: string;
  readonly guess: string;
  readonly options: readonly string[];
}

interface WhoMoreEntry {
  readonly id: string;
  readonly text: string;
}

interface TelepathyEntry {
  readonly id: string;
  readonly text: string;
  readonly options: readonly string[];
}

function predict(deck: QuizDeckId, entries: readonly PredictEntry[]): QuizQuestion[] {
  return entries.map(
    (e): QuizQuestion => ({
      id: e.id,
      kind: 'predict',
      deck,
      self: e.self,
      guess: e.guess,
      options: e.options,
    }),
  );
}

function whoMore(deck: QuizDeckId, entries: readonly WhoMoreEntry[]): QuizQuestion[] {
  return entries.map((e): QuizQuestion => ({ id: e.id, kind: 'whoMore', deck, text: e.text }));
}

function telepathy(deck: QuizDeckId, entries: readonly TelepathyEntry[]): QuizQuestion[] {
  return entries.map(
    (e): QuizQuestion => ({ id: e.id, kind: 'telepathy', deck, text: e.text, options: e.options }),
  );
}

// ═══════════════════════════ Predicción · mazo light ═══════════════════════════

const PREDICT_LIGHT: readonly PredictEntry[] = [
  // ── Comida y antojos ──
  {
    id: 'p-desayuno-sonado',
    self: '¿Cuál es tu desayuno soñado?',
    guess: '¿Cuál es el desayuno soñado de {name}?',
    options: ['Mate con facturas', 'Tostadas con palta', 'Yogur con frutas', 'Café y salir corriendo'],
  },
  {
    id: 'p-pizza',
    self: '¿Qué pizza pedís sin mirar la carta?',
    guess: '¿Qué pizza pide {name} sin mirar la carta?',
    options: ['Muzza de siempre', 'Fugazzeta rellena', 'Napolitana con ajo', 'Con ananá, sin culpa'],
  },
  {
    id: 'p-helado',
    self: '¿Qué gusto de helado pedís siempre?',
    guess: '¿Qué gusto de helado pide siempre {name}?',
    options: ['Dulce de leche', 'Chocolate amargo', 'Frutilla al agua', 'Sambayón'],
  },
  {
    id: 'p-un-solo-plato',
    self: 'Si comieras una sola cosa todo un año, ¿qué sería?',
    guess: 'Si {name} comiera una sola cosa todo un año, ¿qué sería?',
    options: ['Milanesas', 'Empanadas', 'Ñoquis', 'Sushi'],
  },
  {
    id: 'p-antojo-medianoche',
    self: 'Antojo de medianoche: ¿qué vas a buscar?',
    guess: 'Antojo de medianoche: ¿qué va a buscar {name}?',
    options: ['Chocolate escondido', 'Papas fritas', 'Fiambre de la heladera', 'Una fruta (posta)'],
  },
  {
    id: 'p-combinacion-rara',
    self: '¿Qué combinación rara te encanta?',
    guess: '¿Qué combinación rara le encanta a {name}?',
    options: [
      'Papas fritas con helado',
      'Pizza fría de desayuno',
      'Pochoclo con chocolate',
      'Nada raro, lo clásico',
    ],
  },
  {
    id: 'p-cocinar-impresionar',
    self: 'Para impresionar con la cocina, ¿qué preparás?',
    guess: 'Para impresionar con la cocina, ¿qué prepara {name}?',
    options: ['Pastas caseras', 'Un asado', 'Una receta de internet', 'Delivery disimulado'],
  },
  {
    id: 'p-heladera-vacia',
    self: 'Heladera casi vacía: ¿qué cocinás?',
    guess: 'Heladera casi vacía: ¿qué cocina {name}?',
    options: ['Fideos con manteca', 'Tortilla de lo que hay', 'Huevo frito con pan', 'Un mate y a dormir'],
  },
  {
    id: 'p-torta-cumple',
    self: '¿Qué torta elegís para tu cumple?',
    guess: '¿Qué torta elige {name} para su cumple?',
    options: ['Chocotorta', 'Lemon pie', 'Rogel', 'Selva negra'],
  },
  {
    id: 'p-mate',
    self: '¿Cómo tomás el mate?',
    guess: '¿Cómo toma el mate {name}?',
    options: ['Amargo', 'Dulce', 'Con yuyos', 'Paso, gracias'],
  },
  {
    id: 'p-restaurante',
    self: 'En un restaurante nuevo, ¿qué pedís?',
    guess: 'En un restaurante nuevo, ¿qué pide {name}?',
    options: ['Lo de siempre', 'Lo más raro de la carta', 'Lo que recomienden', 'Lo de la mesa de al lado'],
  },

  // ── Viajes y lugares ──
  {
    id: 'p-escapada',
    self: '¿Qué preferís para una escapada?',
    guess: '¿Qué prefiere {name} para una escapada?',
    options: ['Playa y siesta', 'Montaña y mate', 'Ciudad y museos', 'Quedarnos en casa'],
  },
  {
    id: 'p-valija',
    self: '¿Qué nunca falta en tu valija?',
    guess: '¿Qué nunca falta en la valija de {name}?',
    options: ['Snacks de emergencia', 'Cargador extra', 'Ropa para un mes', 'La almohada propia'],
  },
  {
    id: 'p-avion',
    self: 'En un viaje en avión, ¿qué hacés?',
    guess: 'En un viaje en avión, ¿qué hace {name}?',
    options: ['Dormir todo el vuelo', 'Mirar por la ventanilla', 'Pelis sin parar', 'Contar turbulencias'],
  },
  {
    id: 'p-viaje-tiempo',
    self: 'Si pudieras viajar en el tiempo, ¿a dónde irías?',
    guess: 'Si {name} pudiera viajar en el tiempo, ¿a dónde iría?',
    options: ['Al Jurásico', 'Al año 3000', 'A la Antigua Roma', 'A ayer, a dormir más'],
  },
  {
    id: 'p-casa-sonada',
    self: 'Si pudieras vivir en cualquier lado, ¿dónde sería?',
    guess: 'Si {name} pudiera vivir en cualquier lado, ¿dónde sería?',
    options: ['Casa en la playa', 'Cabaña en el bosque', 'Depto en el centro', 'Casa rodante'],
  },
  {
    id: 'p-marte',
    self: 'Si te mudaras a Marte, ¿qué extrañarías más?',
    guess: 'Si {name} se mudara a Marte, ¿qué extrañaría más?',
    options: ['El asado del domingo', 'El mar', 'La siesta', 'El wifi de casa'],
  },

  // ── Sueño y mañanas ──
  {
    id: 'p-alarma',
    self: '¿Cuántas veces posponés la alarma?',
    guess: '¿Cuántas veces pospone {name} la alarma?',
    options: ['Cero: arriba al toque', 'Una, por las dudas', 'Tres o cuatro', '¿Qué alarma?'],
  },
  {
    id: 'p-pose-dormir',
    self: '¿En qué posición dormís?',
    guess: '¿En qué posición duerme {name}?',
    options: ['Estrella de mar', 'En bolita', 'Boca abajo', 'Abrazando la almohada'],
  },
  {
    id: 'p-siesta',
    self: '¿Cuánto dura tu siesta ideal?',
    guess: '¿Cuánto dura la siesta ideal de {name}?',
    options: ['Veinte minutos', 'Una hora justa', 'Hasta que oscurezca', 'Siesta no, gracias'],
  },
  {
    id: 'p-dormir-mejor',
    self: '¿Cómo dormís mejor?',
    guess: '¿Cómo duerme mejor {name}?',
    options: ['Con ventilador', 'Bajo tres frazadas', 'Con una pata afuera', 'Con ruido de lluvia'],
  },
  {
    id: 'p-lunes-animal',
    self: '¿Qué animal sos un lunes a la mañana?',
    guess: '¿Qué animal es {name} un lunes a la mañana?',
    options: ['Koala con sueño', 'Búho sin café', 'Colibrí acelerado', 'Oso que hiberna'],
  },

  // ── Superpoderes e hipótesis absurdas ──
  {
    id: 'p-superpoder',
    self: '¿Qué superpoder elegirías?',
    guess: '¿Qué superpoder elegiría {name}?',
    options: ['Volar', 'Teletransporte', 'Hablar con animales', 'Pausar el tiempo'],
  },
  {
    id: 'p-poder-inutil',
    self: '¿Qué superpoder inútil te tocaría?',
    guess: '¿Qué superpoder inútil le tocaría a {name}?',
    options: [
      'Saber la hora sin reloj',
      'Silbar con la nariz',
      'Hallar medias perdidas',
      'Estornudar en silencio',
    ],
  },
  {
    id: 'p-zombis',
    self: 'Apocalipsis zombi: ¿qué rol cumplís en el grupo?',
    guess: 'Apocalipsis zombi: ¿qué rol cumple {name} en el grupo?',
    options: [
      'Liderar la resistencia',
      'Cocinar con lo que hay',
      'Esconderse en el súper',
      'Negociar con zombis',
    ],
  },
  {
    id: 'p-mascota-casa',
    self: 'Si fueras la mascota de la casa por un día, ¿qué serías?',
    guess: 'Si {name} fuera la mascota de la casa por un día, ¿qué sería?',
    options: ['Un gato con actitud', 'Un perro feliz', 'Un loro charlatán', 'Un pez muy zen'],
  },
  {
    id: 'p-isla-desierta',
    self: '¿Qué te llevás a una isla desierta?',
    guess: '¿Qué se lleva {name} a una isla desierta?',
    options: ['Una hamaca paraguaya', 'Protector solar', 'Una guitarra', 'Wifi, de algún modo'],
  },
  {
    id: 'p-invisible',
    self: 'Si fueras invisible por un día, ¿qué harías?',
    guess: 'Si {name} fuera invisible por un día, ¿qué haría?',
    options: [
      'Colarse en un recital',
      'Ver qué hace el gato',
      'Hacer bromas épicas',
      'Lo mismo, pero en pijama',
    ],
  },
  {
    id: 'p-pato',
    self: 'Si un pato te declara la guerra, ¿qué hacés?',
    guess: 'Si un pato le declara la guerra a {name}, ¿qué hace?',
    options: ['Negociar la paz', 'Huir sin mirar atrás', 'Sobornarlo con pan', 'Pelear con honor'],
  },
  {
    id: 'p-deporte-inventado',
    self: '¿En qué deporte inventado ganarías el oro?',
    guess: '¿En qué deporte inventado ganaría el oro {name}?',
    options: [
      'Siesta sincronizada',
      'Salto de charcos',
      'Carrera al colectivo',
      'Lanzamiento de ojotas',
    ],
  },
  {
    id: 'p-robot',
    self: 'Si tuvieras un robot, ¿qué tarea le darías?',
    guess: 'Si {name} tuviera un robot, ¿qué tarea le daría?',
    options: ['Cebar mates', 'Ir a las reuniones', 'Hacer las compras', 'Contar chistes malos'],
  },

  // ── Música, pelis y series ──
  {
    id: 'p-genero-peli',
    self: 'Viernes de peli: ¿qué género elegís?',
    guess: 'Viernes de peli: ¿qué género elige {name}?',
    options: [
      'Comedia tonta',
      'Terror con luz prendida',
      'Romántica para llorar',
      'Acción con explosiones',
    ],
  },
  {
    id: 'p-vida-pelicula',
    self: 'Si tu vida fuera una película, ¿de qué género sería?',
    guess: 'Si la vida de {name} fuera una película, ¿de qué género sería?',
    options: ['Comedia de enredos', 'Aventura épica', 'Documental de siestas', 'Musical improvisado'],
  },
  {
    id: 'p-karaoke',
    self: 'En el karaoke, ¿qué cantás?',
    guess: 'En el karaoke, ¿qué canta {name}?',
    options: ['Un clásico del rock', 'Cumbia a todo volumen', 'Una balada dramática', 'Solo los coros'],
  },
  {
    id: 'p-serie-nueva',
    self: '¿Cómo mirás una serie nueva?',
    guess: '¿Cómo mira {name} una serie nueva?',
    options: [
      'Un capítulo por noche',
      'Toda en un finde',
      'Abandonarla a la mitad',
      'Leer spoilers antes',
    ],
  },
  {
    id: 'p-banda',
    self: 'Si tocaras en una banda, ¿qué tocarías?',
    guess: 'Si {name} tocara en una banda, ¿qué tocaría?',
    options: ['Batería', 'Guitarra eléctrica', 'Pandereta con pasión', 'El triángulo'],
  },
  {
    id: 'p-ducha',
    self: '¿Qué hacés en la ducha?',
    guess: '¿Qué hace {name} en la ducha?',
    options: [
      'Cantar a todo pulmón',
      'Pensar la vida',
      'Entrevistas imaginarias',
      'Salir en tres minutos',
    ],
  },

  // ── Casa, hábitos y celular ──
  {
    id: 'p-tarea-casa',
    self: '¿Qué tarea de la casa preferís hacer?',
    guess: '¿Qué tarea de la casa prefiere hacer {name}?',
    options: ['Lavar los platos', 'Cocinar', 'Doblar la ropa', 'Pasar la aspiradora'],
  },
  {
    id: 'p-super',
    self: 'En el súper, ¿qué hacés?',
    guess: 'En el súper, ¿qué hace {name}?',
    options: [
      'Seguir la lista',
      'Comprar por antojo',
      'Probar las muestras',
      'Perderse en las góndolas',
    ],
  },
  {
    id: 'p-plantas',
    self: '¿Cómo te va con las plantas?',
    guess: '¿Cómo le va a {name} con las plantas?',
    options: ['Selva en casa', 'Sobreviven de milagro', 'Solo cactus', 'Plantas de plástico'],
  },
  {
    id: 'p-ropa-casa',
    self: '¿Qué te ponés para estar en casa?',
    guess: '¿Qué se pone {name} para estar en casa?',
    options: ['Pijama de ositos', 'Jogging de batalla', 'Remera gigante', 'Ropa de salir, igual'],
  },
  {
    id: 'p-fondo-pantalla',
    self: '¿Qué tenés de fondo de pantalla en el celu?',
    guess: '¿Qué tiene {name} de fondo de pantalla en el celu?',
    options: ['Una mascota', 'Un paisaje', 'Un meme', 'El que vino de fábrica'],
  },
  {
    id: 'p-bateria',
    self: '¿Con cuánta batería empezás a preocuparte?',
    guess: '¿Con cuánta batería empieza a preocuparse {name}?',
    options: ['Con el 50%', 'Con el 20%', 'Con el 5%', 'Cuando se apaga'],
  },
  {
    id: 'p-mensajes',
    self: '¿Cómo respondés los mensajes?',
    guess: '¿Cómo responde {name} los mensajes?',
    options: ['Al instante', 'Con audios eternos', 'Solo con stickers', 'Tres días después'],
  },
  {
    id: 'p-chat-equivocado',
    self: 'Si mandás un mensaje al chat equivocado, ¿qué hacés?',
    guess: 'Si {name} manda un mensaje al chat equivocado, ¿qué hace?',
    options: [
      'Borrarlo al instante',
      'Taparlo con un meme',
      'Asumirlo con dignidad',
      'Cambiar de identidad',
    ],
  },
  {
    id: 'p-olor',
    self: '¿Qué olor te pone de buen humor?',
    guess: '¿Qué olor pone de buen humor a {name}?',
    options: ['Pan recién horneado', 'Tierra mojada', 'Ropa limpia', 'Café a la mañana'],
  },
  {
    id: 'p-impresion',
    self: '¿Qué te da más impresión?',
    guess: '¿Qué le da más impresión a {name}?',
    options: ['Las polillas', 'Los payasos', 'Pisar mojado en medias', 'Los muñecos antiguos'],
  },
  {
    id: 'p-arana',
    self: 'Aparece una araña en casa: ¿qué hacés?',
    guess: 'Aparece una araña en casa: ¿qué hace {name}?',
    options: ['Sacarla con un vaso', 'Ponerle nombre', 'Gritar y huir', 'Vender la casa'],
  },

  // ── Planes, juntadas y festejos ──
  {
    id: 'p-finde-lluvia',
    self: 'Finde de lluvia: ¿qué plan elegís?',
    guess: 'Finde de lluvia: ¿qué plan elige {name}?',
    options: ['Mantita y serie', 'Cocinar algo rico', 'Juegos de mesa', 'Salir igual y mojarse'],
  },
  {
    id: 'p-cumple',
    self: '¿Cómo te gusta festejar tu cumple?',
    guess: '¿Cómo le gusta festejar su cumple a {name}?',
    options: ['Fiesta grande', 'Cena tranquila', 'Que no se note', 'Una semana entera'],
  },
  {
    id: 'p-fiesta-sorpresa',
    self: 'Si te hacen una fiesta sorpresa, ¿cómo reaccionás?',
    guess: 'Si le hacen una fiesta sorpresa a {name}, ¿cómo reacciona?',
    options: ['Llorar de emoción', 'Fingir sorpresa', 'Gritar del susto', 'Bailar al instante'],
  },
  {
    id: 'p-juntada-rol',
    self: '¿Qué rol tenés en una juntada?',
    guess: '¿Qué rol tiene {name} en una juntada?',
    options: ['Alma de la fiesta', 'DJ sin permiso', 'A cargo del asado', 'Charla en la cocina'],
  },
  {
    id: 'p-juegos-mesa',
    self: '¿Cómo jugás a los juegos de mesa?',
    guess: '¿Cómo juega {name} a los juegos de mesa?',
    options: ['A ganar o morir', 'Para reír y perder', 'Leyendo el reglamento', 'Inventando reglas'],
  },
  {
    id: 'p-talento-oculto',
    self: '¿Cuál es tu talento oculto?',
    guess: '¿Cuál es el talento oculto de {name}?',
    options: [
      'Imitar voces',
      'Dormir en cualquier lado',
      'Recordar cumpleaños',
      'Estacionar a la primera',
    ],
  },
  {
    id: 'p-perro-calle',
    self: 'Ves un perro en la calle: ¿qué hacés?',
    guess: '{name} ve un perro en la calle: ¿qué hace?',
    options: [
      'Saludarlo con voz finita',
      'Pedir permiso y mimarlo',
      'Sacarle una foto',
      'Seguir de largo',
    ],
  },
  {
    id: 'p-nombre-mascota',
    self: '¿Qué nombre le pondrías a una mascota?',
    guess: '¿Qué nombre le pondría {name} a una mascota?',
    options: ['Milanesa', 'Señor Bigotes', 'Pochoclo', 'Ramón'],
  },
];

// ══════════════════════════ Predicción · mazo romance ══════════════════════════

const PREDICT_ROMANCE: readonly PredictEntry[] = [
  // ── Gestos y formas de dar cariño ──
  {
    id: 'p-gesto-derrite',
    self: '¿Qué gesto te derrite?',
    guess: '¿Qué gesto derrite a {name}?',
    options: ['Un mensaje sorpresa', 'Una comida casera', 'Un abrazo largo', 'Una nota escondida'],
  },
  {
    id: 'p-carino-sin-palabras',
    self: '¿Cómo demostrás cariño sin palabras?',
    guess: '¿Cómo demuestra cariño {name} sin palabras?',
    options: ['Con comida', 'Con abrazos', 'Con favores sorpresa', 'Con memes a toda hora'],
  },
  {
    id: 'p-detalle-chiquito',
    self: '¿Qué detalle chiquito te alegra más?',
    guess: '¿Qué detalle chiquito alegra más a {name}?',
    options: [
      'El último bocado guardado',
      'Un mate ya cebado',
      'La cama tendida',
      'Una canción dedicada',
    ],
  },
  {
    id: 'p-mensaje-alegra',
    self: '¿Qué mensaje te alegra el día?',
    guess: '¿Qué mensaje le alegra el día a {name}?',
    options: ['Buen día con corazón', 'Un meme dedicado', 'Una foto del almuerzo', 'Un audio cantado'],
  },
  {
    id: 'p-abrazo',
    self: '¿Cuál es tu abrazo favorito?',
    guess: '¿Cuál es el abrazo favorito de {name}?',
    options: ['De oso, bien apretado', 'Por la espalda', 'Largo y en silencio', 'Con saltito incluido'],
  },
  {
    id: 'p-regalito',
    self: '¿Qué regalito te hace más ilusión?',
    guess: '¿Qué regalito le hace más ilusión a {name}?',
    options: ['Flores', 'Chocolates', 'Una planta', 'Un dibujo hecho a mano'],
  },
  {
    id: 'p-sorpresa',
    self: '¿Qué sorpresa te gustaría recibir?',
    guess: '¿Qué sorpresa le gustaría recibir a {name}?',
    options: ['Desayuno en la cama', 'Una carta a mano', 'Una escapada', 'La comida favorita'],
  },
  {
    id: 'p-cuidado-enfermo',
    self: 'Cuando te enfermás, ¿qué cuidado preferís?',
    guess: 'Cuando {name} se enferma, ¿qué cuidado prefiere?',
    options: ['Sopa casera', 'Mimos y mantita', 'Silencio y siesta', 'Atención VIP 24 horas'],
  },
  {
    id: 'p-apodo',
    self: '¿Qué tipo de apodo cariñoso te gusta más?',
    guess: '¿Qué tipo de apodo cariñoso le gusta más a {name}?',
    options: [
      'Amor, el clásico',
      'Algo dulce, tipo bombón',
      'Uno ridículo e inventado',
      'El nombre, y listo',
    ],
  },

  // ── Citas y planes de a dos ──
  {
    id: 'p-cita-ideal',
    self: '¿Cómo es tu cita ideal?',
    guess: '¿Cómo es la cita ideal de {name}?',
    options: ['Picnic al atardecer', 'Cena con velas', 'Cine y helado', 'Paseo por la costanera'],
  },
  {
    id: 'p-plan-de-a-dos',
    self: '¿Qué plan de a dos preferís?',
    guess: '¿Qué plan de a dos prefiere {name}?',
    options: ['Cocinar a cuatro manos', 'Caminar sin rumbo', 'Maratón de series', 'Charlar hasta tarde'],
  },
  {
    id: 'p-lluvia-cita',
    self: 'Si llueve en plena cita, ¿qué hacés?',
    guess: 'Si llueve en plena cita, ¿qué hace {name}?',
    options: ['Bailar bajo la lluvia', 'Correr a un café', 'Reírse y empaparse', 'Volver y pedir pizza'],
  },
  {
    id: 'p-bailar-lento',
    self: '¿Qué música ponés para bailar lento de a dos?',
    guess: '¿Qué música pone {name} para bailar lento de a dos?',
    options: [
      'Un bolero de abuelos',
      'Una balada romántica',
      'Un tema de película',
      'Cumbia, aunque no pegue',
    ],
  },
  {
    id: 'p-peli-romantica',
    self: '¿Qué tipo de peli romántica verías mil veces?',
    guess: '¿Qué tipo de peli romántica vería mil veces {name}?',
    options: [
      'Comedia romántica',
      'Animada que hace llorar',
      'Clásico en blanco y negro',
      'Una de acción, igual',
    ],
  },
  {
    id: 'p-momento-del-dia',
    self: '¿Qué momento del día en pareja disfrutás más?',
    guess: '¿Qué momento del día en pareja disfruta más {name}?',
    options: ['El desayuno', 'La sobremesa', 'Antes de dormir', 'El reencuentro'],
  },
  {
    id: 'p-carta-amor',
    self: 'Si escribieras una carta de amor, ¿cómo sería?',
    guess: 'Si {name} escribiera una carta de amor, ¿cómo sería?',
    options: [
      'Un poema con rima',
      'Tres líneas y un dibujo',
      'Una lista de motivos',
      'Un audio de 10 minutos',
    ],
  },

  // ── Recuerdos y sueños (livianitos) ──
  {
    id: 'p-primera-impresion',
    self: 'Cuando se conocieron, ¿qué te llamó la atención?',
    guess: 'Cuando se conocieron, ¿qué le llamó la atención a {name}?',
    options: ['La sonrisa', 'El humor', 'La mirada', 'La forma de hablar'],
  },
  {
    id: 'p-primera-cita',
    self: 'En la primera cita, ¿qué sentías más?',
    guess: 'En la primera cita, ¿qué sentía más {name}?',
    options: ['Nervios a full', 'Mariposas', 'Hambre, la verdad', 'Ganas de reír'],
  },
  {
    id: 'p-recuerdo',
    self: '¿Qué tipo de recuerdo de a dos atesorás más?',
    guess: '¿Qué tipo de recuerdo de a dos atesora más {name}?',
    options: ['Un viaje', 'Una charla eterna', 'Un ataque de risa', 'Un día cualquiera'],
  },
  {
    id: 'p-aniversario',
    self: '¿Cómo te gustaría festejar un aniversario?',
    guess: '¿Cómo le gustaría festejar un aniversario a {name}?',
    options: ['Viaje sorpresa', 'Cena elegante', 'Repetir la primera cita', 'Pijama y pizza'],
  },
  {
    id: 'p-viaje-romantico',
    self: '¿Cómo sería tu viaje romántico soñado?',
    guess: '¿Cómo sería el viaje romántico soñado de {name}?',
    options: ['París, cliché total', 'Cabaña en la nieve', 'Isla con hamacas', 'Ruta sin destino'],
  },
  {
    id: 'p-sueno-de-a-dos',
    self: '¿Qué sueño de a dos te gustaría cumplir?',
    guess: '¿Qué sueño de a dos le gustaría cumplir a {name}?',
    options: [
      'Dar la vuelta al mundo',
      'Adoptar una mascota',
      'Una casa con jardín',
      'Aprender a bailar',
    ],
  },
  {
    id: 'p-extranar-viaje',
    self: 'Cuando viajás sin tu pareja, ¿qué extrañás primero?',
    guess: 'Cuando {name} viaja sin vos, ¿qué extraña primero?',
    options: ['Los abrazos', 'Las charlas', 'Los mates compartidos', 'El robo de frazadas'],
  },
];

// ═══════════════════════ ¿Quién es más probable…? · light ═══════════════════════

const WHO_MORE_LIGHT: readonly WhoMoreEntry[] = [
  { id: 'w-risa-inoportuna', text: '¿Quién es más probable que se ría en el momento menos indicado?' },
  { id: 'w-celu-en-mano', text: '¿Quién es más probable que busque el celu teniéndolo en la mano?' },
  { id: 'w-hablar-plantas', text: '¿Quién es más probable que le hable a las plantas?' },
  { id: 'w-llorar-publicidad', text: '¿Quién es más probable que llore con una publicidad?' },
  { id: 'w-zombi-mascota', text: '¿Quién es más probable que adopte un zombi como mascota?' },
  { id: 'w-perro-calle', text: '¿Quién es más probable que vuelva a casa con un perro de la calle?' },
  { id: 'w-dormir-cine', text: '¿Quién es más probable que se duerma en el cine?' },
  { id: 'w-cantar-auto', text: '¿Quién es más probable que cante a los gritos en el auto?' },
  { id: 'w-isla-desierta', text: '¿Quién duraría más tiempo en una isla desierta?' },
  { id: 'w-spoiler', text: '¿Quién es más probable que cuente un spoiler sin querer?' },
  { id: 'w-viral', text: '¿Quién es más probable que se haga viral por accidente?' },
  { id: 'w-bailar-super', text: '¿Quién es más probable que se ponga a bailar en el súper?' },
  { id: 'w-gps', text: '¿Quién es más probable que se pierda aun con el GPS prendido?' },
  {
    id: 'w-saludo-error',
    text: '¿Quién es más probable que salude por error a alguien que no conoce?',
  },
  { id: 'w-porcion-verguenza', text: '¿Quién es más probable que se coma la porción de la vergüenza?' },
  {
    id: 'w-perdon-silla',
    text: '¿Quién es más probable que le pida perdón a una silla después de chocarla?',
  },
  {
    id: 'w-diez-alarmas',
    text: '¿Quién es más probable que ponga diez alarmas y no escuche ninguna?',
  },
  { id: 'w-reality-cocina', text: '¿Quién es más probable que gane un reality de cocina?' },
  { id: 'w-extraterrestre', text: '¿Quién es más probable que haga amistad con un extraterrestre?' },
  { id: 'w-hablar-en-suenos', text: '¿Quién es más probable que hable en sueños?' },
  { id: 'w-voz-mascotas', text: '¿Quién es más probable que le invente una voz a cada mascota?' },
  { id: 'w-receta-inventada', text: '¿Quién es más probable que invente una receta y le salga rica?' },
  {
    id: 'w-charla-fila',
    text: '¿Quién es más probable que termine charlando con media fila del banco?',
  },
  { id: 'w-reto-absurdo', text: '¿Quién es más probable que acepte un reto absurdo sin pensarlo?' },
  {
    id: 'w-planilla-vacaciones',
    text: '¿Quién es más probable que arme una planilla para las vacaciones?',
  },
  {
    id: 'w-risa-propio-chiste',
    text: '¿Quién es más probable que se ría de su propio chiste antes de terminarlo?',
  },
  { id: 'w-adivinar-final', text: '¿Quién es más probable que adivine el final de la película?' },
  { id: 'w-consejos-tele', text: '¿Quién es más probable que le grite consejos a la tele?' },
  {
    id: 'w-olvidar-a-que-fue',
    text: '¿Quién es más probable que entre a un cuarto y olvide a qué fue?',
  },
  {
    id: 'w-disfraz',
    text: '¿Quién es más probable que vaya con disfraz a una fiesta sin disfraces?',
  },
  { id: 'w-barco-pirata', text: '¿Quién estaría al mando de un barco pirata?' },
  {
    id: 'w-palabras-inventadas',
    text: '¿Quién es más probable que invente palabras y las use en serio?',
  },
];

// ══════════════════════ ¿Quién es más probable…? · romance ══════════════════════

const WHO_MORE_ROMANCE: readonly WhoMoreEntry[] = [
  { id: 'w-dedicar-cancion', text: '¿Quién es más probable que dedique una canción por mensaje?' },
  { id: 'w-sorpresa-secreta', text: '¿Quién es más probable que organice una sorpresa en secreto?' },
  {
    id: 'w-entrada-recuerdo',
    text: '¿Quién es más probable que guarde de recuerdo la entrada del cine?',
  },
  { id: 'w-casamiento', text: '¿Quién es más probable que se emocione en un casamiento?' },
  { id: 'w-abrazo-sorpresa', text: '¿Quién es más probable que dé abrazos sorpresa por la espalda?' },
  {
    id: 'w-apodos-ridiculos',
    text: '¿Quién es más probable que invente apodos cada vez más ridículos?',
  },
  { id: 'w-desayuno-sorpresa', text: '¿Quién es más probable que prepare el desayuno de sorpresa?' },
  {
    id: 'w-bailar-cocina',
    text: '¿Quién es más probable que proponga bailar en medio de la cocina?',
  },
  { id: 'w-notitas', text: '¿Quién es más probable que deje notitas de amor escondidas?' },
  { id: 'w-frazadas', text: '¿Quién es más probable que se adueñe de las frazadas a la noche?' },
  { id: 'w-mimos-cachorro', text: '¿Quién es más probable que pida mimos con cara de cachorro?' },
  { id: 'w-poema-cursi', text: '¿Quién es más probable que escriba un poema cursi?' },
  {
    id: 'w-volver-primera-cita',
    text: '¿Quién es más probable que quiera volver al lugar de la primera cita?',
  },
  {
    id: 'w-fotos-salidas',
    text: '¿Quién es más probable que guarde fotos de cada salida de a dos?',
  },
];

// ══════════════════════════════ Telepatía · light ══════════════════════════════

const TELEPATHY_LIGHT: readonly TelepathyEntry[] = [
  {
    id: 't-plan-domingo',
    text: 'Sin hablar: ¿cuál es el mejor plan de domingo?',
    options: ['Asado y sobremesa', 'Pijama y series', 'Feria y paseo', 'Siesta épica'],
  },
  {
    id: 't-empanada',
    text: 'Sin hablar: ¿cuál es la mejor empanada?',
    options: ['Carne a cuchillo', 'Jamón y queso', 'Humita', 'Caprese'],
  },
  {
    id: 't-mascota',
    text: 'Sin hablar: ¿qué mascota adoptarían hoy?',
    options: ['Un perro', 'Un gato', 'Un conejo', 'Un carpincho'],
  },
  {
    id: 't-delivery',
    text: 'Sin hablar: ¿qué piden de delivery esta noche?',
    options: ['Pizza', 'Sushi', 'Hamburguesas', 'Milanesa con papas'],
  },
  {
    id: 't-fruta',
    text: 'Sin hablar: ¿cuál es la fruta más rica?',
    options: ['Frutilla', 'Mango', 'Sandía', 'Durazno'],
  },
  {
    id: 't-estacion',
    text: 'Sin hablar: ¿cuál es la mejor estación del año?',
    options: ['Verano', 'Otoño', 'Invierno', 'Primavera'],
  },
  {
    id: 't-numero',
    text: 'Sin hablar: ¿qué número eligen?',
    options: ['3', '7', '10', '42'],
  },
  {
    id: 't-mudanza',
    text: 'Sin hablar: en una mudanza, ¿qué se pierde primero?',
    options: ['Las llaves', 'El control remoto', 'Un tornillo clave', 'El cargador'],
  },
  {
    id: 't-dinosaurio',
    text: 'Sin hablar: ¿qué dinosaurio sería la mejor mascota?',
    options: ['Tiranosaurio', 'Brontosaurio', 'Pterodáctilo', 'Estegosaurio'],
  },
  {
    id: 't-escondite-zombi',
    text: 'Sin hablar: apocalipsis zombi, ¿dónde se esconden?',
    options: ['En el súper', 'En el shopping', 'En el campo', 'En la biblioteca'],
  },
  {
    id: 't-musica-cocina',
    text: 'Sin hablar: ¿qué música suena mientras cocinan?',
    options: ['Rock nacional', 'Cumbia', 'Pop bien arriba', 'Jazz suavecito'],
  },
  {
    id: 't-juego-mesa',
    text: 'Sin hablar: ¿a qué juegan esta noche?',
    options: ['Truco', 'Generala', 'Chinchón', 'Dígalo con mímica'],
  },
  {
    id: 't-dulce',
    text: 'Sin hablar: ¿cuál es el mejor dulce?',
    options: ['De leche', 'De membrillo', 'De batata', 'De frutilla'],
  },
  {
    id: 't-color-lunes',
    text: 'Sin hablar: ¿de qué color es un lunes?',
    options: ['Gris', 'Azul', 'Marrón', 'Violeta'],
  },
  {
    id: 't-barco-pirata',
    text: 'Sin hablar: ¿cómo se llama su barco pirata?',
    options: ['El Chimichurri', 'La Milanesa Veloz', 'El Mate Errante', 'La Ojota Dorada'],
  },
  {
    id: 't-arboles-isla',
    text: 'Sin hablar: en la isla mágica, ¿qué crece en los árboles?',
    options: ['Empanadas', 'Alfajores', 'Medialunas', 'Pochoclos'],
  },
  {
    id: 't-dia-semana',
    text: 'Sin hablar: ¿cuál es el mejor día de la semana?',
    options: ['Viernes', 'Sábado', 'Domingo', 'Cualquier feriado'],
  },
  {
    id: 't-cruzar-oceano',
    text: 'Sin hablar: ¿cómo cruzan el océano?',
    options: ['En velero', 'En globo aerostático', 'En submarino', 'Sobre una ballena'],
  },
  {
    id: 't-postre',
    text: 'Sin hablar: ¿cuál es el mejor postre?',
    options: ['Flan casero', 'Helado', 'Panqueques', 'Ensalada de frutas'],
  },
  {
    id: 't-palabra-graciosa',
    text: 'Sin hablar: ¿cuál es la palabra más graciosa?',
    options: ['Chancleta', 'Cachivache', 'Zapallo', 'Pantufla'],
  },
  {
    id: 't-electrodomestico',
    text: 'Sin hablar: ¿cuál es el electrodoméstico más heroico?',
    options: ['La pava eléctrica', 'El lavarropas', 'La heladera', 'El microondas'],
  },
  {
    id: 't-sonido-relajante',
    text: 'Sin hablar: ¿cuál es el sonido más relajante?',
    options: ['Lluvia en el techo', 'Olas del mar', 'Un gato ronroneando', 'Pájaros a la mañana'],
  },
  {
    id: 't-viaje-en-auto',
    text: 'Sin hablar: ¿qué no puede faltar en un viaje en auto?',
    options: ['Alfajores', 'Mate y termo', 'Buena playlist', 'Sándwiches de miga'],
  },
  {
    id: 't-isla-secreta',
    text: 'Sin hablar: ¿cómo se llama su isla secreta?',
    options: ['Isla Siesta', 'Isla Mate', 'Isla Caos', 'Isla Pochoclo'],
  },
];

// ═════════════════════════════ Telepatía · romance ═════════════════════════════

const TELEPATHY_ROMANCE: readonly TelepathyEntry[] = [
  {
    id: 't-cita-hoy',
    text: 'Sin hablar: ¿cuál sería la cita perfecta hoy?',
    options: ['Picnic al sol', 'Mirar estrellas', 'Karaoke a dúo', 'Cena casera'],
  },
  {
    id: 't-apodo-duo',
    text: 'Sin hablar: ¿qué apodo le queda a este dúo?',
    options: ['Dúo Dinámico', 'Pan y Manteca', 'Caos y Calma', 'Mate y Bizcocho'],
  },
  {
    id: 't-gesto-romantico',
    text: 'Sin hablar: ¿cuál es el gesto más romántico?',
    options: ['Una serenata', 'Flores sin motivo', 'Una playlist dedicada', 'Un abrazo eterno'],
  },
  {
    id: 't-flor',
    text: 'Sin hablar: si fueran una flor, ¿cuál serían?',
    options: ['Girasol', 'Rosa', 'Margarita', 'Cactus en flor'],
  },
  {
    id: 't-atardecer',
    text: 'Sin hablar: ¿dónde es mejor mirar el atardecer?',
    options: ['En la playa', 'En una terraza', 'Arriba de un cerro', 'En un muelle'],
  },
  {
    id: 't-comida-romantica',
    text: 'Sin hablar: ¿cuál es la comida más romántica?',
    options: ['Pasta compartida', 'Fondue de chocolate', 'Pizza en el sillón', 'Picada con velas'],
  },
  {
    id: 't-titulo-pelicula',
    text: 'Sin hablar: ¿cómo se llamaría la película de su historia?',
    options: ['Amor a primera risa', 'Caos para dos', 'Dos y un mate', 'Misión: abrazo'],
  },
  {
    id: 't-palabra-duo',
    text: 'Sin hablar: ¿qué palabra define a este dúo?',
    options: ['Risas', 'Aventura', 'Ternura', 'Caos'],
  },
  {
    id: 't-mejor-mimo',
    text: 'Sin hablar: ¿cuál es el mejor mimo?',
    options: ['Mimos en la cabeza', 'Abrazo de cucharita', 'Masajito en los pies', 'Rascar la espalda'],
  },
  {
    id: 't-ritmo',
    text: 'Sin hablar: ¿qué ritmo bailarían de a dos?',
    options: ['Cumbia', 'Tango', 'Salsa', 'Un lento de película'],
  },
  {
    id: 't-momento-revivir',
    text: 'Sin hablar: ¿qué momento de a dos les gustaría revivir?',
    options: ['La primera cita', 'El primer viaje', 'Una noche de risas', 'Un domingo cualquiera'],
  },
];

// ═══════════════════════════════════ Banco ═══════════════════════════════════

/** Todas las preguntas, agrupadas por tipo y mazo (en este orden; mezclar al armar rondas). */
export const QUIZ_BANK: readonly QuizQuestion[] = [
  ...predict('light', PREDICT_LIGHT),
  ...predict('romance', PREDICT_ROMANCE),
  ...whoMore('light', WHO_MORE_LIGHT),
  ...whoMore('romance', WHO_MORE_ROMANCE),
  ...telepathy('light', TELEPATHY_LIGHT),
  ...telepathy('romance', TELEPATHY_ROMANCE),
];
