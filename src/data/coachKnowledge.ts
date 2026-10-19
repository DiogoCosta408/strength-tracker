// Diagnostic interview + weak-point knowledge base used by the offline coach.
// Each answer maps to cues, specific variations/accessories and programming notes.

export type LiftFamily = 'squat' | 'bench' | 'deadlift' | 'press';

/** A concrete exercise suggestion that can be added to a program. */
export interface Rx {
  exerciseId: string;
  sets: number;
  reps: number;
  rpe: number;
  why: string;
}

export interface Advice {
  cues?: string[];
  rx?: Rx[];
  programming?: string[];
}

export interface Question {
  id: string;
  text: string;
  help?: string;
  multi?: boolean;
  options: { id: string; label: string; advice?: Advice }[];
}

export const FAMILY_LABEL: Record<LiftFamily, string> = { squat: 'Squat', bench: 'Bench press', deadlift: 'Deadlift', press: 'Overhead press' };
export const FAMILY_MAIN: Record<LiftFamily, string> = { squat: 'squat', bench: 'bench-press', deadlift: 'deadlift', press: 'press' };

const rx = (exerciseId: string, sets: number, reps: number, rpe: number, why: string): Rx => ({ exerciseId, sets, reps, rpe, why });

const FEEL: Question = {
  id: 'feel',
  text: 'How do heavy reps usually go?',
  options: [
    {
      id: 'grind',
      label: 'Slow the whole way, a grind from start to finish',
      advice: {
        programming: [
          'A slow rep from start to finish usually means you lack force overall, not a single weak point. Build capacity first: run a 4-6 week block with more volume at moderate loads (e.g. 4-5 × 5-6 @ RPE 7-8) before going heavy again.',
        ],
      },
    },
    {
      id: 'sticking',
      label: 'Fast, then it slows down or stops at one spot',
      advice: {
        programming: ['A clear sticking point responds well to a variation that overloads or lengthens time in that range. Use it as your second weekly exposure for 4-6 weeks, then retest.'],
      },
    },
    {
      id: 'setup',
      label: 'It goes wrong before the hard part (setup, brace, unrack)',
      advice: {
        cues: ['Rehearse the identical setup on every warm-up set, empty bar included.', 'Big breath into the belly and sides, then brace before you unrack or break the floor, not after.'],
        programming: ['Lower the RPE of top sets by 0.5-1 for 3 weeks and judge each set by technique: a set only counts if the setup was identical.'],
      },
    },
    {
      id: 'confidence',
      label: 'Physically fine, but heavy weight feels scary or "heavy in the hands"',
      advice: {
        programming: ['Add 1 heavy single at RPE 8 before your work sets 1-2× a week. Regular exposure to heavy loads improves confidence and technical consistency.'],
      },
    },
  ],
};

export const QUESTIONS: Record<LiftFamily, Question[]> = {
  squat: [
    {
      id: 'fail_point',
      text: 'Where does the squat fail or feel hardest?',
      options: [
        {
          id: 'hole',
          label: 'Out of the hole (first few cm from the bottom)',
          advice: {
            cues: ['Stay tight at the bottom and keep the brace; don\'t relax into the hole.', 'Drive knees out as you come up and push the floor away.'],
            rx: [rx('pause-squat', 3, 3, 7, 'Removes the stretch reflex, so you build strength and position out of the hole'), rx('pin-squat', 3, 3, 7.5, 'Dead start from the bottom builds starting strength'), rx('front-squat', 3, 5, 7, 'More quad demand at depth')],
          },
        },
        {
          id: 'mid',
          label: 'Mid-range sticking point (just above parallel)',
          advice: {
            cues: ['Keep accelerating through the whole rep: aim to finish fast, not just to get through the sticking point.', 'Chest and hips rise at the same rate.'],
            rx: [rx('pin-squat-high', 3, 3, 8, 'Overloads the exact range where you stall'), rx('back-squat-tempo', 3, 4, 7, 'Builds control and position through the whole range'), rx('anderson-squat', 3, 3, 8, 'Concentric-only start from the sticking point')],
          },
        },
        {
          id: 'lockout',
          label: 'Near lockout',
          advice: {
            cues: ['Squeeze the glutes to finish and keep driving the back into the bar.'],
            rx: [rx('hip-thrust', 3, 8, 8, 'Hip extension strength for the finish'), rx('pin-squat-high', 3, 3, 8, 'Heavy partials build confidence with heavy loads near the top')],
            programming: ['Missing near lockout is rare and usually means the bottom half drained you. Also check what happens lower in the rep.'],
          },
        },
      ],
    },
    {
      id: 'breakdown',
      text: 'What does your technique do when it gets heavy?',
      multi: true,
      options: [
        {
          id: 'hips_rise',
          label: 'Hips shoot up / chest drops (turns into a good morning)',
          advice: {
            cues: ['Lead out of the hole with your upper back: drive the bar up into your traps.', 'Keep the brace: losing intra-abdominal pressure lets the torso fold.'],
            rx: [rx('ssb-squat', 3, 5, 7, 'Forces an upright torso and loads the upper back'), rx('front-squat', 3, 4, 7, 'Quad strength; punishes a folding torso'), rx('pause-squat', 3, 3, 7, 'Teaches you to keep position at the bottom')],
            programming: ['Usually quads or upper back are the limiter. Add 6-8 weekly hard sets of a quad-dominant squat variation.'],
          },
        },
        {
          id: 'knees_cave',
          label: 'Knees cave in',
          advice: {
            cues: ['Screw your feet into the floor and push knees in line with your toes throughout.', 'A small, brief knee movement is common in heavy squats; repeated or large valgus is the problem.'],
            rx: [rx('back-squat-tempo', 3, 4, 6.5, 'Slow eccentric to practise knee tracking under load'), rx('hip-adduction', 3, 12, 8, 'Adductors are a prime mover out of the hole'), rx('bulgarian-split-squat', 3, 8, 8, 'Single-leg control and quad/adductor strength')],
          },
        },
        {
          id: 'forward',
          label: 'Weight shifts to toes / bar drifts forward',
          advice: {
            cues: ['Keep the bar over mid-foot: whole-foot pressure, especially through the heel and big toe.', 'Low bar: hips back and chest angled forward together. High bar: sit down between the heels.'],
            rx: [rx('pause-squat', 3, 3, 6.5, 'Find and own a balanced bottom position'), rx('back-squat-tempo', 2, 5, 6, 'Balance practice through the whole rep')],
          },
        },
        {
          id: 'depth',
          label: 'Cutting depth when heavy',
          advice: {
            cues: ['Hit the same depth every rep, including warm-ups.'],
            rx: [rx('pause-squat', 3, 3, 7, 'Makes you hit and own depth'), rx('box-squat', 3, 3, 7, 'A consistent depth target')],
            programming: ['Film your top sets from the side at 45°. If depth slips above ~RPE 8, cap top sets at RPE 8 for a few weeks.'],
          },
        },
        { id: 'none', label: 'Nothing obvious' },
      ],
    },
    FEEL,
  ],

  bench: [
    {
      id: 'fail_point',
      text: 'Where does the bench fail or feel hardest?',
      options: [
        {
          id: 'chest',
          label: 'Off the chest',
          advice: {
            cues: ['Leg drive: push your feet into the floor before and during the press, not only once the bar is moving.', 'Touch slightly lower on the sternum with forearms vertical, and keep the lats tight on the way down.'],
            rx: [rx('bench-3ct-pause', 3, 3, 7.5, 'Longer pause builds starting strength off the chest'), rx('spoto-press', 3, 4, 7.5, 'Pause just above the chest, where you lose tension'), rx('wide-grip-bench', 3, 6, 7, 'More pec and range of motion')],
            programming: ['Bench responds well to frequency: 3 sessions a week (comp bench + variation + volume day) usually beats 2.'],
          },
        },
        {
          id: 'mid',
          label: 'Mid-range (a few cm above the chest)',
          advice: {
            cues: ['Press back toward the rack: the bar path should curve over the shoulders.', 'Flare the elbows after the bar leaves the chest, not before.'],
            rx: [rx('pin-press', 3, 3, 8, 'Dead start right at your sticking point'), rx('spoto-press', 3, 4, 7.5, 'Strength just above the chest'), rx('close-grip-bench', 3, 6, 7.5, 'Triceps and front delts take over mid-range')],
          },
        },
        {
          id: 'lockout',
          label: 'Lockout (last third)',
          advice: {
            cues: ['Drive the bar back over the shoulders and fully extend the elbows.'],
            rx: [rx('close-grip-bench', 4, 5, 8, 'Primary triceps-biased bench variation'), rx('board-press-2', 3, 3, 8, 'Overloads the top half'), rx('skull-crusher', 3, 10, 8, 'Triceps hypertrophy'), rx('dip', 3, 8, 8, 'Heavy triceps/chest pressing')],
          },
        },
      ],
    },
    {
      id: 'breakdown',
      text: 'What happens to your technique on heavy reps?',
      multi: true,
      options: [
        {
          id: 'butt',
          label: 'Butt comes off the bench',
          advice: {
            cues: ['Push the feet back toward your head instead of up: drive the traps into the bench.', 'Set your feet further back or wider so leg drive goes horizontal.'],
            rx: [rx('feet-up-bench', 2, 6, 7, 'Teaches upper-body tightness without relying on legs')],
          },
        },
        {
          id: 'bounce',
          label: 'Bar sinks / bounces at the chest',
          advice: {
            cues: ['Control the descent at the same speed every rep, and squeeze the bar off the chest rather than bouncing it.'],
            rx: [rx('tempo-bench', 3, 5, 7, 'Eccentric control and a consistent touch point'), rx('bench-2ct-pause', 3, 4, 7.5, 'Competition-style pause discipline')],
          },
        },
        {
          id: 'elbows',
          label: 'Elbows flare early / shoulders roll forward',
          advice: {
            cues: ['Bend the bar and pull the shoulder blades down and back before unracking.', 'Tuck on the way down; flare only once the bar leaves the chest.'],
            rx: [rx('larsen-press', 3, 5, 7, 'Removes leg drive, rewards upper-back tightness and stable shoulders'), rx('chest-supported-row', 3, 10, 8, 'Upper back holds the arch and stable base'), rx('face-pull', 3, 15, 8, 'Rear delts and shoulder health')],
          },
        },
        {
          id: 'uneven',
          label: 'One side lags / bar tilts',
          advice: {
            rx: [rx('dumbbell-bench-press', 3, 8, 8, 'Each arm works on its own, which exposes and fixes the weaker side')],
            cues: ['Check that your grip width is even, using the rings on the bar.'],
          },
        },
        { id: 'none', label: 'Nothing obvious' },
      ],
    },
    FEEL,
  ],

  deadlift: [
    {
      id: 'fail_point',
      text: 'Where does the deadlift fail or feel hardest?',
      options: [
        {
          id: 'floor',
          label: 'Breaking it off the floor',
          advice: {
            cues: ['Pull the slack out of the bar and wedge your hips into position before you pull.', 'Think "push the floor away" (a leg press) rather than "pull the bar up".'],
            rx: [rx('deficit-deadlift', 3, 3, 7.5, 'More range from the floor and more quad/leg drive'), rx('paused-deadlift-off-floor', 3, 2, 7, 'Strength and position just after the bar leaves the floor'), rx('front-squat', 3, 5, 7, 'Quads drive the first pull')],
          },
        },
        {
          id: 'knee',
          label: 'At / just below the knee',
          advice: {
            cues: ['Keep the bar dragging up your shins and thighs; don\'t let it drift forward around the knees.', 'Shoulders stay over the bar until it passes the knees.'],
            rx: [rx('paused-deadlift', 3, 2, 7.5, 'Pause just below the knee builds position where you lose it'), rx('romanian-deadlift', 3, 6, 7.5, 'Hamstrings and hip hinge strength in that range'), rx('good-morning', 3, 6, 7, 'Back and hip extensors')],
          },
        },
        {
          id: 'lockout',
          label: 'Lockout (above the knee)',
          advice: {
            cues: ['Drive the hips through into the bar; stand tall without leaning back.', 'Missing lockout often starts lower: if the bar drifted away from you, fix that first.'],
            rx: [rx('block-pull', 3, 3, 8, 'Overloads the top range'), rx('hip-thrust', 3, 8, 8, 'Hip extension strength for lockout'), rx('barbell-shrug', 3, 10, 8, 'Upper back and traps to finish tall')],
          },
        },
      ],
    },
    {
      id: 'breakdown',
      text: 'What breaks down on heavy pulls?',
      multi: true,
      options: [
        {
          id: 'round',
          label: 'Lower back rounds',
          advice: {
            cues: ['Big breath and brace hard before the pull. A belt helps you brace against something.', 'Some upper-back rounding can be fine for advanced pullers; lumbar rounding that increases during the pull is the issue.'],
            rx: [rx('paused-deadlift', 3, 2, 7, 'Teaches you to keep position under load'), rx('good-morning', 3, 8, 7, 'Strengthens the erectors'), rx('back-extension', 3, 12, 8, 'Lower-back endurance')],
            programming: ['Cap deadlift top sets at RPE 8 for 3-4 weeks while the variation work builds position.'],
          },
        },
        {
          id: 'drift',
          label: 'Bar drifts away from the body',
          advice: {
            cues: ['Engage the lats ("protect your armpits", "bend the bar around your legs") before you pull.'],
            rx: [rx('straight-arm-pulldown', 3, 12, 8, 'Trains lat engagement'), rx('paused-deadlift', 3, 2, 7, 'Holding position exposes bar drift')],
          },
        },
        {
          id: 'hips_first',
          label: 'Hips shoot up first (stiff-legging it)',
          advice: {
            cues: ['Start with the hips slightly lower, shins touching the bar, and push with the legs as the bar breaks.'],
            rx: [rx('deficit-deadlift', 3, 3, 7, 'Forces leg drive off the floor'), rx('front-squat', 3, 5, 7, 'Builds the quads that keep hips from rising')],
          },
        },
        {
          id: 'grip',
          label: 'Grip gives out',
          advice: {
            cues: ['Use a hook grip or mixed grip for heavy sets; chalk.', 'Use straps for back-off volume only if grip is limiting training stimulus.'],
            rx: [rx('farmers-walk', 3, 30, 8, 'Grip endurance (reps = metres or seconds)'), rx('rack-pull', 2, 1, 8, 'Heavy holds: hold the lockout for 10-15 s')],
          },
        },
        { id: 'none', label: 'Nothing obvious' },
      ],
    },
    FEEL,
  ],

  press: [
    {
      id: 'fail_point',
      text: 'Where does the press fail or feel hardest?',
      options: [
        {
          id: 'shoulders',
          label: 'Off the shoulders',
          advice: {
            cues: ['Start with the forearms vertical and elbows slightly in front of the bar.', 'Squeeze glutes and quads so the force goes into the bar, not into a layback.'],
            rx: [rx('paused-press', 3, 3, 7.5, 'Starting strength from the shoulders'), rx('z-press', 3, 6, 7.5, 'No leg or hip help, so it isolates pressing from the bottom'), rx('incline-bench-press', 3, 6, 8, 'Front delts and upper chest')],
          },
        },
        {
          id: 'forehead',
          label: 'Around forehead height',
          advice: {
            cues: ['Move your head back out of the way, then push it "through the window" once the bar passes your forehead.', 'Keep the bar path straight and close to the face.'],
            rx: [rx('pin-press-overhead', 3, 3, 8, 'Dead start at the sticking point'), rx('seated-dumbbell-press', 3, 8, 8, 'Delt strength through the range')],
          },
        },
        {
          id: 'lockout',
          label: 'Lockout overhead',
          advice: {
            cues: ['Finish by shrugging up into the bar with the bar over your mid-foot.'],
            rx: [rx('push-press', 3, 3, 8, 'Overloads the top of the press'), rx('close-grip-bench', 3, 6, 8, 'Triceps strength'), rx('lateral-raise', 3, 15, 8, 'Side delts')],
          },
        },
      ],
    },
    {
      id: 'breakdown',
      text: 'What happens to your technique on heavy reps?',
      multi: true,
      options: [
        {
          id: 'layback',
          label: 'Excessive lean back',
          advice: {
            cues: ['Brace the abs and squeeze the glutes; lean only enough to get your face out of the way.'],
            rx: [rx('z-press', 3, 6, 7, 'Punishes any layback'), rx('ab-wheel', 3, 10, 8, 'Anterior core stiffness')],
          },
        },
        {
          id: 'bar_forward',
          label: 'Bar drifts forward',
          advice: {
            cues: ['Keep the bar over your mid-foot and get under it once it passes your head.'],
            rx: [rx('behind-the-neck-press', 3, 6, 7, 'Grooves an upright path (only with good shoulder mobility)'), rx('face-pull', 3, 15, 8, 'Upper-back support')],
          },
        },
        { id: 'none', label: 'Nothing obvious' },
      ],
    },
    FEEL,
  ],
};

/** Lifestyle questions shared across lifts. */
export const RECOVERY_QUESTIONS: Question[] = [
  {
    id: 'sleep',
    text: 'How much do you sleep on average?',
    options: [
      { id: 'lt6', label: 'Less than 6 h', advice: { programming: ['Sleep is the biggest recovery lever you have. Below 6 h, strength gains slow considerably. Aim for 7-9 h before changing the program.'] } },
      { id: '6to7', label: '6-7 h', advice: { programming: ['An extra 30-60 min of sleep is one of the cheapest performance improvements available.'] } },
      { id: '7plus', label: '7+ h' },
    ],
  },
  {
    id: 'diet',
    text: 'What is your current diet phase?',
    options: [
      { id: 'deficit', label: 'Cutting / calorie deficit', advice: { programming: ['In a calorie deficit, holding strength is a win. Expect slower e1RM progress, reduce volume ~20%, and keep intensity (heavy singles/triples at RPE 7-8) to keep strength.'] } },
      { id: 'maintain', label: 'Maintenance' },
      { id: 'surplus', label: 'Surplus / bulking' },
      { id: 'unsure', label: 'Not tracking', advice: { programming: ['If bodyweight is drifting down while lifts stall, you may be under-eating. Aim for ~1.6-2.2 g/kg protein and stable or slowly rising bodyweight.'] } },
    ],
  },
  {
    id: 'stress',
    text: 'Life stress lately?',
    options: [
      { id: 'high', label: 'High', advice: { programming: ['Under high stress, cut the session by 1-2 back-off sets and use RPE honestly. Autoregulation exists for exactly this.'] } },
      { id: 'normal', label: 'Normal' },
    ],
  },
];

export interface DiagnosisResult {
  cues: string[];
  rx: Rx[];
  programming: string[];
}

/** Collects the advice attached to each selected answer, removing duplicates. */
export function adviseFromAnswers(family: LiftFamily, answers: Record<string, string[]>): DiagnosisResult {
  const out: DiagnosisResult = { cues: [], rx: [], programming: [] };
  const seenRx = new Set<string>();
  for (const q of [...QUESTIONS[family], ...RECOVERY_QUESTIONS]) {
    for (const optId of answers[q.id] ?? []) {
      const a = q.options.find((o) => o.id === optId)?.advice;
      if (!a) continue;
      a.cues?.forEach((c) => !out.cues.includes(c) && out.cues.push(c));
      a.programming?.forEach((p) => !out.programming.includes(p) && out.programming.push(p));
      a.rx?.forEach((r) => {
        if (!seenRx.has(r.exerciseId)) {
          seenRx.add(r.exerciseId);
          out.rx.push(r);
        }
      });
    }
  }
  return out;
}

/** Human-readable summary of answers, used to give the AI coach context. */
export function describeAnswers(family: LiftFamily, answers: Record<string, string[]>): string[] {
  const lines: string[] = [];
  for (const q of [...QUESTIONS[family], ...RECOVERY_QUESTIONS]) {
    const labels = (answers[q.id] ?? []).map((id) => q.options.find((o) => o.id === id)?.label).filter(Boolean);
    if (labels.length) lines.push(`${q.text} → ${labels.join('; ')}`);
  }
  return lines;
}
