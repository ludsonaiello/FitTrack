const TIPS = {
  en: {
    CHEST: [
      'Keep your shoulder blades pinched back — it protects your shoulders and increases range of motion.',
      'Lower the bar slowly. The eccentric (negative) phase builds as much muscle as the push.',
      'Drive through the floor with your feet to create a full-body base of power.',
      'Keep your wrists straight and directly above your elbows for safe pressing.',
    ],
    BACK: [
      'Initiate every pull with your elbows, not your hands — your back, not your biceps, does the work.',
      'Squeeze your shoulder blades together at the top of every rep.',
      'Keep your chest up and core braced to protect your lower back.',
      'Think about pulling your elbows into your back pockets on rows.',
    ],
    LEGS: [
      'Drive through your entire foot — not just the toes — on squats and presses.',
      'Keep your chest tall and spine neutral; a rounded back under load risks injury.',
      'Control the descent — a slow lower builds more strength than dropping the weight.',
      'Point your toes and knees in the same direction throughout the movement.',
    ],
    SHOULDERS: [
      'Avoid full lockout on lateral raises — keep tension on the deltoids at the top.',
      'Control the negative to increase time under tension and prevent injury.',
      'Brace your core tight on overhead work to prevent lower back strain.',
      'Think of leading with your elbows on raises, not your hands.',
    ],
    ARMS: [
      'Keep your elbows locked in place — swinging defeats the purpose of isolation.',
      'Squeeze hard at the peak contraction for 1–2 seconds.',
      'Full range of motion produces better results than heavy partial reps.',
      'Supinate your wrists (palms up) at the top of curls for maximum bicep activation.',
    ],
    FULL_BODY: [
      'Compound lifts recruit the most muscle and deliver the most hormonal response.',
      'Breathe out on the effort (concentric) and in on the return (eccentric).',
      'Form first — chasing weight before mastering the pattern leads to injury.',
      'Short rest (30–45 s) increases metabolic stress; longer rest (2–3 min) maximises strength.',
    ],
    GENERAL: [
      'Progressive overload — adding a little more each week — is the single most important principle.',
      'Rest 60–90 seconds between sets for hypertrophy, 2–3 minutes for strength.',
      'Hydration matters: even mild dehydration cuts performance by up to 10%.',
      'Sleep is when your muscles actually grow. Aim for 7–9 hours.',
      'Consistency over months beats any single "perfect" workout.',
      'Tracking your lifts lets you see progress that feels invisible day-to-day.',
      'Warming up with lighter sets primes the nervous system and reduces injury risk.',
      'Mind-muscle connection — really thinking about the muscle — measurably increases activation.',
    ],
  },
  'pt-BR': {
    CHEST: [
      'Mantenha as escápulas retraídas — protege os ombros e aumenta a amplitude de movimento.',
      'Desça a barra devagar. A fase excêntrica (descida) constrói tanto músculo quanto o empurrão.',
      'Empurre o chão com os pés para criar uma base sólida de força em todo o corpo.',
      'Mantenha os pulsos retos, diretamente acima dos cotovelos, para pressionar com segurança.',
    ],
    BACK: [
      'Inicie cada puxada pelos cotovelos, não pelas mãos — são as costas, não o bíceps, que trabalham.',
      'Aperte as escápulas juntas no topo de cada repetição.',
      'Mantenha o peito erguido e o core ativado para proteger a lombar.',
      'Pense em puxar os cotovelos em direção aos bolsos das calças nas remadas.',
    ],
    LEGS: [
      'Empurre com todo o pé — não só com as pontas — nos agachamentos e prensas.',
      'Mantenha o tronco ereto e a coluna neutra; coluna arredondada com carga causa lesões.',
      'Controle a descida — baixar devagar constrói mais força do que deixar cair o peso.',
      'Aponte os joelhos e os dedos dos pés na mesma direção durante o movimento.',
    ],
    SHOULDERS: [
      'Evite travar o cotovelo nas elevações laterais — mantenha a tensão nos deltoides no topo.',
      'Controle a fase negativa para aumentar o tempo sob tensão e evitar lesões.',
      'Ative bem o core nos exercícios acima da cabeça para não sobrecarregar a lombar.',
      'Nas elevações, pense em liderar com os cotovelos, não com as mãos.',
    ],
    ARMS: [
      'Mantenha os cotovelos fixos — balançar o corpo anula o isolamento.',
      'Contraia forte no pico do movimento por 1–2 segundos.',
      'Amplitude completa gera resultados melhores do que repetições parciais com mais peso.',
      'Supine os pulsos (palmas para cima) no topo das roscas para máxima ativação do bíceps.',
    ],
    FULL_BODY: [
      'Movimentos compostos recrutam mais músculos e geram maior resposta hormonal.',
      'Expire no esforço (concêntrico) e inspire no retorno (excêntrico).',
      'Forma primeiro — buscar peso antes de dominar o padrão leva a lesões.',
      'Descanso curto (30–45 s) aumenta o estresse metabólico; descanso longo (2–3 min) maximiza a força.',
    ],
    GENERAL: [
      'Sobrecarga progressiva — adicionar um pouco mais a cada semana — é o princípio mais importante.',
      'Descanse 60–90 segundos entre séries para hipertrofia, 2–3 minutos para força.',
      'Hidratação é essencial: até desidratação leve reduz a performance em até 10%.',
      'O sono é quando seus músculos realmente crescem. Mire em 7–9 horas.',
      'Consistência ao longo dos meses supera qualquer treino "perfeito" isolado.',
      'Registrar seus pesos permite ver o progresso que parece invisível no dia a dia.',
      'Aquecer com séries mais leves prepara o sistema nervoso e reduz o risco de lesões.',
      'Conexão mente-músculo — pensar no músculo trabalhado — aumenta mensuravelmente a ativação.',
    ],
  },
}

/**
 * Returns a random workout tip for the given focus areas and language.
 * Falls back to GENERAL tips if no focus-area-specific tips exist.
 * @param {string[]} focusAreas  e.g. ['CHEST', 'FULL_BODY']
 * @param {string}   language    e.g. 'en' | 'pt-BR'
 * @returns {string|null}
 */
export function getRandomTip(focusAreas, language) {
  const lang = TIPS[language] ?? TIPS.en
  const primaryArea = (focusAreas ?? []).find(f => lang[f])
  const pool = [
    ...(primaryArea ? (lang[primaryArea] ?? []) : []),
    ...(lang.GENERAL ?? []),
  ]
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
