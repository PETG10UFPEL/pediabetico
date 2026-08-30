// ---------------------------------------------------------------------------
// Motor de simulação — evolução do paciente com diabetes tipo 2 (foco em pé
// diabético, com trilha paralela de retinopatia para ilustrar o tema
// macro x microvascular).
//
// IMPORTANTE: este é um modelo educacional simplificado. As magnitudes dos
// efeitos (multiplicadores) foram calibradas para reproduzir, de forma
// aproximada, as ORDENS DE GRANDEZA relatadas na literatura abaixo — não é
// um modelo estatístico validado nem deve orientar decisões clínicas reais.
//
// Fontes usadas para calibrar as âncoras numéricas:
// - Armstrong DG, Boulton AJM, Bus SA. "Diabetic Foot Ulcers and Their
//   Recurrence." N Engl J Med. 2017;376:2367-2375.
//     · incidência anual de úlcera: 1.7–6.3%/ano em diversas coortes
//     · >50% das úlceras infectam; ~20% das infecções moderadas/graves
//       evoluem para algum grau de amputação
//     · recorrência após cicatrização: ~40% em 1 ano, ~60% em 3 anos,
//       ~65% em 5 anos, >90% em 10 anos
//     · mortalidade em 5 anos após amputação maior: >70%
// - Armstrong DG et al. "Five-year mortality and direct costs of care for
//   people with diabetic foot complications are comparable to cancer."
//   J Foot Ankle Res. 2020;13:16.
//     · mortalidade em 5 anos: DFU 30.5%, amputação menor 46.2%,
//       amputação maior 56.6%
// - Klein R et al. (Wisconsin Epidemiologic Study of Diabetic Retinopathy).
//     · prevalência de retinopatia por tempo de diagnóstico (ex.: ~29% com
//       <5 anos de doença até ~78–98% com ≥15 anos, variando por coorte)
// - Sheehan P et al. Diabetes Care. 2003;26:1879-82 — reutilizado aqui
//   como sub-modelo de cicatrização por episódio de úlcera (curva
//   exponencial calibrada pelos extremos "cicatrizou" x "não cicatrizou").
// - DCCT/UKPDS (achado consolidado): cada ponto percentual de HbA1c acima
//   da meta amplia o risco de complicações microvasculares; usamos um
//   multiplicador exponencial ilustrativo com esse mesmo sentido.
// ---------------------------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Interpola HbA1c ao longo do tempo: parte de um valor "não controlado" e
// converge linearmente para um valor "em tratamento" ao longo de N anos.
function hba1cAt(year, params) {
  const { hba1cInicial, hba1cTratado, anosParaEstabilizar } = params;
  if (year >= anosParaEstabilizar) return hba1cTratado;
  const frac = year / Math.max(1, anosParaEstabilizar);
  return hba1cInicial + (hba1cTratado - hba1cInicial) * frac;
}

// Multiplicador de risco microvascular por HbA1c (ilustrativo, ancorado no
// sentido do achado DCCT/UKPDS: cada ponto acima de 7% eleva risco).
function microHazardMult(hba1c) {
  return Math.exp(0.16 * (hba1c - 7));
}

// --- Sub-modelo de cicatrização de um episódio de úlcera (mesma lógica do
// simulador anterior, agora parametrizado pelas variáveis desta simulação).
function runUlcerEpisode(rng, ctx) {
  const { hba1c, pad, footCareAdherence, woundCareQuality } = ctx;

  const mHba1c = clamp(1 - (hba1c - 7) * 0.08, 0.25, 1);
  const mPad = pad ? 0.55 : 1;
  const mCare = 0.5 + 0.5 * (footCareAdherence / 100); // offloading/adesão
  const mWound = 0.6 + 0.6 * (woundCareQuality / 100); // desbridamento+cobertura

  const K_MAX = 0.43;
  const K_MIN = 0.05;
  let k = K_MAX * mHba1c * mPad * mCare * mWound;
  k = clamp(k, K_MIN, K_MAX);

  const par4 = (1 - Math.exp(-4 * k)) * 100;

  // probabilidade de infecção: cai conforme PAR4 sobe. Calibrado para que,
  // no paciente "médio" da literatura (par4 moderado), fique perto de 50%+
  // ("mais da metade das úlceras infectam" — Armstrong 2017).
  const infectionProb = clamp(0.85 - par4 / 130, 0.15, 0.85);
  const infected = rng() < infectionProb;

  let outcome = { infected, amputation: null, weeksToHeal: null };

  if (infected) {
    const amputationProb = pad ? 0.30 : 0.20; // Armstrong: ~20%, PAD eleva
    if (rng() < amputationProb) {
      outcome.amputation = rng() < 0.65 ? 'menor' : 'maior';
    } else {
      // trata e cicatriza, porém mais devagar
      const kSlow = Math.max(K_MIN, k * 0.55);
      outcome.weeksToHeal = Math.log(0.05) / -kSlow;
    }
  } else {
    outcome.weeksToHeal = Math.log(0.05) / -k;
  }

  outcome.par4 = par4;
  outcome.k = k;
  return outcome;
}

// Risco de recorrência (hazard anual aproximado) dado o tempo desde a
// última cicatrização — calibrado para bater, em cumulativo, perto de
// 40% @1a / ~60% @3a / ~65% @5a (Armstrong 2017).
function recurrenceHazard(yearsSinceHeal) {
  const table = [0.40, 0.16, 0.10, 0.05, 0.035];
  const idx = Math.min(table.length - 1, Math.floor(yearsSinceHeal));
  return table[idx];
}

// Estágios de retinopatia (trilha paralela, tema macro x micro do texto).
const RETINO_STAGES = [
  'Sem retinopatia',
  'Retinopatia não proliferativa leve',
  'Retinopatia não proliferativa moderada/grave',
  'Retinopatia proliferativa',
];

function stepRetinopathy(stage, hba1c, rng) {
  if (stage >= RETINO_STAGES.length - 1) return stage;
  const baseAnnual = [0.05, 0.06, 0.05][stage]; // chance de avançar 1 estágio/ano
  const p = clamp(baseAnnual * microHazardMult(hba1c), 0.01, 0.6);
  if (rng() < p) return stage + 1;
  return stage;
}

// Pequeno gerador pseudoaleatório com seed, para permitir reprodutibilidade
// se quisermos re-exibir a mesma trajetória.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulatePatient(params, seed = Date.now() & 0xffffffff) {
  const rng = mulberry32(seed);
  const horizon = params.horizonYears;

  const state = {
    neuropatia: false,
    pad: false,
    peRisco: false,
    ulceraAtiva: false,
    emRemissao: false,
    yearsSinceHeal: null,
    amputMenor: false,
    amputMaior: false,
    obito: false,
    retinoStage: 0,
    numEpisodios: 0,
  };

  const events = []; // {year, label, detail, kind}
  const yearlySnapshot = [];

  const pushEvent = (year, label, detail, kind) => {
    events.push({ year: Math.round(year * 10) / 10, label, detail, kind });
  };

  pushEvent(0, 'Diagnóstico de diabetes tipo 2', `Idade ao diagnóstico: ${params.idadeDiagnostico} anos.`, 'diagnostico');

  for (let year = 1; year <= horizon; year++) {
    if (state.obito) break;
    const hba1c = hba1cAt(year, params);
    const hf = microHazardMult(hba1c);

    // --- Neuropatia periférica ---
    if (!state.neuropatia) {
      const p = clamp(1 - Math.exp(-0.028 * hf), 0.005, 0.35);
      if (rng() < p) {
        state.neuropatia = true;
        pushEvent(year, 'Neuropatia periférica detectada', `HbA1c média até aqui: ${hba1c.toFixed(1)}%.`, 'neuropatia');
      }
    }

    // --- Doença arterial periférica ---
    if (!state.pad) {
      const smokeMult = params.tabagismo ? 2.2 : 1;
      const p = clamp(1 - Math.exp(-0.02 * hf * smokeMult), 0.005, 0.3);
      if (rng() < p) {
        state.pad = true;
        pushEvent(year, 'Doença arterial periférica (macrovascular)', params.tabagismo ? 'Tabagismo ativo acelerou o processo aterosclerótico.' : 'Detectada em avaliação vascular.', 'pad');
      }
    }

    // --- Pé de risco (requer neuropatia) ---
    if (state.neuropatia && !state.peRisco) {
      const screenMult = params.rastreioPodiatrico ? 0.6 : 1;
      const p = 0.22 * screenMult;
      if (rng() < p) {
        state.peRisco = true;
        pushEvent(year, 'Pé em risco (deformidade / calosidade / perda de proteção sensitiva)', 'Indicação para calçado terapêutico e educação em autocuidado.', 'perisco');
      }
    }

    // --- Úlcera (primeira ou recorrência) ---
    if (state.peRisco && !state.ulceraAtiva) {
      let p;
      if (state.emRemissao) {
        p = recurrenceHazard(state.yearsSinceHeal);
        state.yearsSinceHeal += 1;
      } else {
        p = 0.06; // incidência anual basal (Armstrong: 1.7–6.3%, usamos ponto médio-alto por já ter pé de risco)
      }
      const footwearMult = params.calcadoTerapeutico ? 0.55 : 1;
      const careMult = 1 - (params.adesaoCuidadoPe / 100) * 0.5;
      const padMult = state.pad ? 1.4 : 1;
      p = clamp(p * footwearMult * careMult * padMult, 0.005, 0.85);

      if (rng() < p) {
        state.ulceraAtiva = true;
        state.emRemissao = false;
        state.numEpisodios += 1;
        const label = state.numEpisodios === 1 ? 'Primeira úlcera de pé diabético' : `Recorrência de úlcera (episódio ${state.numEpisodios})`;
        pushEvent(year, label, `Área estimada da lesão em avaliação inicial.`, 'ulcera');

        const outcome = runUlcerEpisode(rng, {
          hba1c, pad: state.pad,
          footCareAdherence: params.adesaoCuidadoPe,
          woundCareQuality: params.qualidadeCurativo,
        });

        if (outcome.infected) {
          pushEvent(year + 0.15, 'Infecção da úlcera', `Redução de área projetada em 4 semanas: ${outcome.par4.toFixed(0)}%.`, 'infeccao');
          if (outcome.amputation) {
            const yearsPostAmp = horizon - year;
            if (outcome.amputation === 'maior') {
              state.amputMaior = true;
              pushEvent(year + 0.3, 'Amputação maior (transtibial/transfemoral)', 'Mortalidade em 5 anos após amputação maior: ~57% (Armstrong 2020).', 'amputacao');
            } else {
              state.amputMenor = true;
              pushEvent(year + 0.3, 'Amputação menor (transmetatársica/dedo)', 'Mortalidade em 5 anos após amputação menor: ~46% (Armstrong 2020).', 'amputacao');
            }
            state.ulceraAtiva = false;
            state.peRisco = true; // continua em risco no membro contralateral / coto
            state.emRemissao = false;
          } else {
            const weeks = outcome.weeksToHeal;
            pushEvent(year + weeks / 52, 'Úlcera cicatrizada (após tratamento de infecção)', `Tempo até fechamento: ~${weeks.toFixed(0)} semanas.`, 'cicatrizacao');
            state.ulceraAtiva = false;
            state.emRemissao = true;
            state.yearsSinceHeal = 0;
          }
        } else {
          const weeks = outcome.weeksToHeal;
          pushEvent(year + weeks / 52, 'Úlcera cicatrizada', `Tempo até fechamento: ~${weeks.toFixed(0)} semanas · redução em 4 sem.: ${outcome.par4.toFixed(0)}%.`, 'cicatrizacao');
          state.ulceraAtiva = false;
          state.emRemissao = true;
          state.yearsSinceHeal = 0;
        }
      }
    }

    // --- Mortalidade pós-amputação (hazard anual aproximado a partir da
    // mortalidade cumulativa em 5 anos) ---
    if (state.amputMaior || state.amputMenor) {
      const cum5 = state.amputMaior ? 0.566 : 0.462;
      const annualHazard = 1 - Math.pow(1 - cum5, 1 / 5);
      if (rng() < annualHazard) {
        state.obito = true;
        pushEvent(year, 'Óbito', 'Mortalidade elevada é esperada após amputação — reforça a importância da prevenção primária.', 'obito');
      }
    }

    // --- Retinopatia (trilha paralela macro x micro) ---
    const newRetino = stepRetinopathy(state.retinoStage, hba1c, rng);
    if (newRetino !== state.retinoStage) {
      state.retinoStage = newRetino;
      pushEvent(year, RETINO_STAGES[newRetino], 'Trilha microvascular paralela — mesmo mecanismo fisiopatológico da lesão no pé.', 'retinopatia');
    }

    yearlySnapshot.push({
      year,
      hba1c,
      neuropatia: state.neuropatia,
      pad: state.pad,
      peRisco: state.peRisco,
      ulceraAtiva: state.ulceraAtiva,
      emRemissao: state.emRemissao,
      amputMenor: state.amputMenor,
      amputMaior: state.amputMaior,
      obito: state.obito,
      retinoStage: state.retinoStage,
    });

    if (state.obito) break;
  }

  return { events, yearlySnapshot, finalState: state, retinoStages: RETINO_STAGES };
}

// --- Simulação populacional (Monte Carlo) para curvas de incidência agregadas ---
export function simulatePopulation(params, n = 300) {
  const stageKeys = ['neuropatia', 'pad', 'peRisco', 'ulceraAtiva_ever', 'amput_ever', 'obito'];
  const horizon = params.horizonYears;
  const counts = Array.from({ length: horizon + 1 }, () => ({
    neuropatia: 0, pad: 0, peRisco: 0, ulcera: 0, amput: 0, obito: 0,
  }));

  for (let i = 0; i < n; i++) {
    const { yearlySnapshot } = simulatePatient(params, (Date.now() + i * 7919) & 0xffffffff);
    let everUlcera = false, everAmput = false;
    for (const snap of yearlySnapshot) {
      const bucket = counts[snap.year];
      if (!bucket) continue;
      if (snap.neuropatia) bucket.neuropatia++;
      if (snap.pad) bucket.pad++;
      if (snap.peRisco) bucket.peRisco++;
      if (snap.ulceraAtiva || snap.emRemissao) everUlcera = true;
      if (snap.amputMenor || snap.amputMaior) everAmput = true;
      if (everUlcera) bucket.ulcera++;
      if (everAmput) bucket.amput++;
      if (snap.obito) bucket.obito++;
    }
  }

  return counts.map((c, year) => ({
    year,
    neuropatia: (100 * c.neuropatia) / n,
    pad: (100 * c.pad) / n,
    peRisco: (100 * c.peRisco) / n,
    ulcera: (100 * c.ulcera) / n,
    amput: (100 * c.amput) / n,
    obito: (100 * c.obito) / n,
  }));
}

// --- Categorização de desfecho final por paciente, para o pictograma
// (isotype chart / "de cada 100 pacientes"). Cada paciente cai em UMA
// categoria, a mais grave que ele atingiu no horizonte simulado.
const OUTCOME_CATEGORIES = [
  { key: 'obito', label: 'Óbito', color: '#0A0A0A', icon: '✝' },
  { key: 'amputacao', label: 'Amputação', color: '#8C1F2F', icon: '✂' },
  { key: 'ulcera', label: 'Teve úlcera (sem amputar)', color: '#FF6B54', icon: '●' },
  { key: 'pe_risco', label: 'Pé de risco (sem úlcera)', color: '#F5B942', icon: '●' },
  { key: 'neuropatia_pad', label: 'Neuropatia/DAP (sem pé de risco)', color: '#5AB8FF', icon: '●' },
  { key: 'sem_complicacoes', label: 'Sem complicações no pé', color: '#3A4A4E', icon: '●' },
];

function categorizePatient(finalState) {
  if (finalState.obito) return 'obito';
  if (finalState.amputMaior || finalState.amputMenor) return 'amputacao';
  if (finalState.numEpisodios > 0) return 'ulcera';
  if (finalState.peRisco) return 'pe_risco';
  if (finalState.neuropatia || finalState.pad) return 'neuropatia_pad';
  return 'sem_complicacoes';
}

export function simulatePopulationOutcomes(params, n = 300) {
  const counts = { obito: 0, amputacao: 0, ulcera: 0, pe_risco: 0, neuropatia_pad: 0, sem_complicacoes: 0 };
  for (let i = 0; i < n; i++) {
    const { finalState } = simulatePatient(params, (Date.now() + i * 104729) & 0xffffffff);
    counts[categorizePatient(finalState)] += 1;
  }
  const total = n;
  const result = OUTCOME_CATEGORIES.map((c) => ({
    ...c,
    count: counts[c.key],
    pct: (100 * counts[c.key]) / total,
  }));
  return result;
}

export { RETINO_STAGES, OUTCOME_CATEGORIES };
