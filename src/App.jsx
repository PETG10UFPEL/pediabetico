import { useMemo, useState } from 'react';
import './App.css';
import { simulatePatient, simulatePopulation, simulatePopulationOutcomes } from './lib/simulation';

const DEFAULT_PARAMS = {
  idadeDiagnostico: 55,
  hba1cInicial: 9.5,
  hba1cTratado: 7.5,
  anosParaEstabilizar: 3,
  tabagismo: false,
  rastreioPodiatrico: true,
  calcadoTerapeutico: false,
  adesaoCuidadoPe: 60,
  qualidadeCurativo: 70,
  horizonYears: 20,
  nPacientes: 300,
};

const KIND_ICON = {
  diagnostico: '🩺', neuropatia: '⚡', pad: '🫀', perisco: '⚠️',
  ulcera: '🔴', infeccao: '🦠', cicatrizacao: '✅', amputacao: '✂️',
  obito: '✝️', retinopatia: '👁️',
};

function Toggle({ label, checked, onChange, hint }) {
  return (
    <div className="field">
      <div className="toggle-row">
        <span>{label}</span>
        <div className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
          <div className="knob" />
        </div>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step = 1, suffix = '', hint }) {
  return (
    <div className="field">
      <label>{label}<span className="val">{value}{suffix}</span></label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function ParamPanel({ params, setParams }) {
  const set = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));
  return (
    <>
      <section className="card">
        <h2><span className="n">01</span> Perfil do paciente</h2>
        <Slider label="Idade ao diagnóstico" value={params.idadeDiagnostico} min={25} max={80}
          suffix=" anos" onChange={set('idadeDiagnostico')} />
        <Slider label="HbA1c ao diagnóstico (sem tratamento)" value={params.hba1cInicial} min={7} max={13} step={0.1}
          suffix="%" onChange={set('hba1cInicial')} />
        <Slider label="HbA1c em tratamento estável" value={params.hba1cTratado} min={5.5} max={11} step={0.1}
          suffix="%" onChange={set('hba1cTratado')}
          hint="A simulação interpola linearmente entre esses dois valores." />
        <Slider label="Anos até estabilizar o controle" value={params.anosParaEstabilizar} min={0} max={10}
          suffix=" anos" onChange={set('anosParaEstabilizar')} />
        <Toggle label="Tabagismo ativo" checked={params.tabagismo} onChange={set('tabagismo')}
          hint="Acelera a doença arterial periférica (macrovascular)." />
      </section>

      <section className="card">
        <h2><span className="n">02</span> Cuidado preventivo do pé</h2>
        <Toggle label="Rastreio podiátrico anual" checked={params.rastreioPodiatrico} onChange={set('rastreioPodiatrico')}
          hint="Detecta neuropatia e deformidades antes da primeira úlcera." />
        <Toggle label="Calçado terapêutico" checked={params.calcadoTerapeutico} onChange={set('calcadoTerapeutico')}
          hint="Reduz a incidência de úlcera em pé já em risco." />
        <Slider label="Adesão ao autocuidado / offloading" value={params.adesaoCuidadoPe} min={0} max={100} step={5}
          suffix="%" onChange={set('adesaoCuidadoPe')} />
        <Slider label="Qualidade do manejo da ferida (quando ocorre)" value={params.qualidadeCurativo} min={0} max={100} step={5}
          suffix="%" onChange={set('qualidadeCurativo')}
          hint="Combina desbridamento e cobertura adequada." />
      </section>

      <section className="card">
        <h2><span className="n">03</span> Horizonte da simulação</h2>
        <Slider label="Anos simulados desde o diagnóstico" value={params.horizonYears} min={5} max={30}
          suffix=" anos" onChange={set('horizonYears')} />
        <Slider label="Pacientes simulados (curva populacional)" value={params.nPacientes} min={50} max={1000} step={50}
          onChange={set('nPacientes')}
          hint="Mais pacientes = curvas mais estáveis, mas demora um pouco mais para calcular." />
      </section>
    </>
  );
}

function TrajectoryView({ params }) {
  const [seed, setSeed] = useState(1);
  const result = useMemo(() => simulatePatient(params, seed), [params, seed]);
  const { events, finalState, retinoStages } = result;

  const stages = [
    { key: 'neuropatia', label: 'Neuropatia' },
    { key: 'pad', label: 'DAP' },
    { key: 'peRisco', label: 'Pé de risco' },
    { key: 'ulcera', label: 'Úlcera', reached: finalState.numEpisodios > 0 },
    { key: 'amput', label: 'Amputação', reached: finalState.amputMenor || finalState.amputMaior },
    { key: 'obito', label: 'Óbito', reached: finalState.obito },
  ];

  return (
    <section className="card">
      <h2><span className="n">→</span> Trajetória simulada de um paciente</h2>

      <div className="summary-row">
        <span className="pill">Horizonte: {params.horizonYears} anos</span>
        <span className="pill">{finalState.numEpisodios} episódio(s) de úlcera</span>
        <span className={`pill ${finalState.amputMaior ? 'bad' : finalState.amputMenor ? 'warn' : 'ok'}`}>
          {finalState.amputMaior ? 'Amputação maior' : finalState.amputMenor ? 'Amputação menor' : 'Sem amputação'}
        </span>
        <span className="pill">{retinoStages[finalState.retinoStage]}</span>
      </div>

      <div className="stagebar">
        {stages.map((s) => (
          <span key={s.key} className={`stage-chip ${(s.reached ?? finalState[s.key]) ? 'reached' : ''}`}>
            {s.label}
          </span>
        ))}
      </div>

      <div className="timeline">
        {events.map((e, i) => (
          <div className={`tl-item kind-${e.kind}`} key={i}>
            <div className="tl-dot" />
            <div className="tl-year">Ano {e.year}{e.kind === 'diagnostico' ? '' : ` (${(params.idadeDiagnostico + e.year).toFixed(0)} anos de idade)`}</div>
            <div className="tl-label">{KIND_ICON[e.kind] || '•'} {e.label}</div>
            <div className="tl-detail">{e.detail}</div>
          </div>
        ))}
      </div>

      <div className="microbadge">
        <div className="eye">👁️🦶</div>
        <p><b>Macro × micro:</b> repare que a trilha de retinopatia avança em paralelo às complicações do pé,
        movida pela mesma variável — controle glicêmico — mas por um mecanismo estritamente microvascular.
        Pacientes com úlcera de pé têm até 90% de chance de retinopatia concomitante (Hwang et al., 2017),
        o que reforça rastrear o fundo de olho sempre que houver uma lesão de pé.</p>
      </div>

      <button className="runbtn" style={{ marginTop: 16 }} onClick={() => setSeed((s) => s + 1)}>
        🎲 Simular novamente (nova trajetória aleatória)
      </button>
    </section>
  );
}

function Pictogram({ params }) {
  const [runId, setRunId] = useState(0);
  const outcomes = useMemo(() => simulatePopulationOutcomes(params, params.nPacientes), [params, runId]);

  // Monta uma grade fixa de 100 quadradinhos, preenchida proporcionalmente
  // (ajusta o arredondamento na maior categoria para somar exatamente 100).
  const raw = outcomes.map((o) => Math.round(o.pct));
  const diff = 100 - raw.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    const biggestIdx = raw.indexOf(Math.max(...raw));
    raw[biggestIdx] += diff;
  }
  const cells = [];
  outcomes.forEach((o, i) => { for (let k = 0; k < raw[i]; k++) cells.push(o); });

  return (
    <section className="card">
      <h2><span className="n">→</span> De cada 100 pacientes com esse perfil…</h2>
      <p className="pico-caption">
        Simulação com <b>{params.nPacientes}</b> pacientes ao longo de <b>{params.horizonYears} anos</b>,
        mapeada para uma grade de 100 (arredondado).
      </p>

      <div className="pictogram-wrap">
        <div className="pictogram-grid">
          {cells.map((c, i) => (
            <div key={i} className="pico" style={{ background: c.color, animationDelay: `${Math.min(i * 12, 900)}ms` }}
              title={c.label} />
          ))}
        </div>

        <div className="pico-legend">
          {outcomes.filter((o) => o.count > 0 || o.pct > 0).map((o) => (
            <div className="pico-legend-item" key={o.key}>
              <span className="pico-legend-swatch" style={{ background: o.color }} />
              <span className="pico-legend-label">{o.label}</span>
              <span className="pico-legend-pct">{o.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <button className="runbtn secondary" onClick={() => setRunId((r) => r + 1)}>
        🔄 Rodar simulação de novo
      </button>
    </section>
  );
}

function PopulationChart({ params }) {
  const data = useMemo(() => simulatePopulation(params, params.nPacientes), [params]);
  const W = 680, H = 300, padL = 40, padR = 14, padT = 16, padB = 30;
  const maxYear = params.horizonYears;
  const x = (year) => padL + (year / maxYear) * (W - padL - padR);
  const y = (pct) => padT + (1 - pct / 100) * (H - padT - padB);

  const series = [
    { key: 'neuropatia', color: '#F5B942', label: 'Neuropatia' },
    { key: 'pad', color: '#B18CFF', label: 'DAP' },
    { key: 'peRisco', color: '#F5B942', label: 'Pé de risco', dash: '4 3' },
    { key: 'ulcera', color: '#FF6B54', label: 'Já teve úlcera' },
    { key: 'amput', color: '#8C1F2F', label: 'Já amputou' },
    { key: 'obito', color: '#5AB8FF', label: 'Óbito' },
  ];

  const path = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.year).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const gy = padT + i * (H - padT - padB) / 4;
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#E7D7BF" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${gy + 3}" text-anchor="end" class="axis-label">${(100 - i * 25)}%</text>`;
  }
  for (let yy = 0; yy <= maxYear; yy += Math.max(1, Math.round(maxYear / 5))) {
    grid += `<text x="${x(yy)}" y="${H - 8}" text-anchor="middle" class="axis-label">ano ${yy}</text>`;
  }

  return (
    <section className="card">
      <h2><span className="n">→</span> Curva populacional ao longo do tempo (Monte Carlo, {params.nPacientes} pacientes)</h2>
      <p className="hint" style={{ marginBottom: 14 }}>
        Cada linha mostra a % de pacientes que já atingiu aquele estágio até cada ano, dado o mesmo perfil de risco definido no painel.
        Útil para ver o efeito agregado de mudar um parâmetro (ex.: ligar o calçado terapêutico) sobre toda uma coorte.
      </p>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} dangerouslySetInnerHTML={{
        __html: grid + series.map((s) => `<path d="${path(s.key)}" fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linecap="round"/>`).join('')
      }} />
      <div className="legend">
        {series.map((s) => (
          <div className="legend-item" key={s.key}>
            <span className="legend-dot" style={{ background: s.color }} />{s.label}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [tab, setTab] = useState('trajetoria');

  return (
    <div className="wrap">
      <header className="top">
        <div className="hero-banner">
          <img src="/hero-banner.jpg" alt="Ilustração: cuidado individual no curativo do pé diabético, conectado visualmente a uma população" className="hero-img" />
        </div>
        <div className="brand-row">
          <img src="/logo-amor-a-pele.png" alt="Amor-à-Pele FE-UFPEL & PET-Saúde G10" className="brand-logo" />
          <div className="eyebrow"><span className="dot" />SIMULAÇÃO EDUCACIONAL — NÃO É FERRAMENTA CLÍNICA</div>
        </div>
        <h1>👁️🦶 Evolução do paciente diabético: do diagnóstico ao pé de risco</h1>
        <p className="sub">
          Modelo ano-a-ano, baseado em ordens de grandeza da literatura (Armstrong et al. 2017/2020, Sheehan et al. 2003,
          Wisconsin Epidemiologic Study of Diabetic Retinopathy). Ajuste o perfil do paciente e observe como a doença
          evolui — desde neuropatia e doença arterial periférica até a primeira úlcera, suas complicações, e a trilha
          paralela de retinopatia.
        </p>
      </header>

      <div className="grid">
        <div>
          <ParamPanel params={params} setParams={setParams} />
        </div>

        <div>
          <div className="tabs">
            <div className={`tab ${tab === 'trajetoria' ? 'active' : ''}`} onClick={() => setTab('trajetoria')}>Trajetória individual</div>
            <div className={`tab ${tab === 'populacao' ? 'active' : ''}`} onClick={() => setTab('populacao')}>Curva populacional</div>
          </div>
          {tab === 'trajetoria' ? <TrajectoryView params={params} /> : (
            <>
              <Pictogram params={params} />
              <PopulationChart params={params} />
            </>
          )}
        </div>
      </div>

      <footer className="foot">
        <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo-amor-a-pele.png" alt="" style={{ height: 20, borderRadius: 4, background: '#fff', padding: '2px 4px' }} />
          Projeto Amor-à-Pele (FE-UFPEL) · PET-Saúde G10 — Telemonitoramento de feridas crônicas
        </p>
        <p><b>Sobre o modelo:</b> os multiplicadores de risco usados aqui (HbA1c, tabagismo, adesão ao autocuidado,
        calçado terapêutico, PAD, qualidade do manejo de ferida) foram calibrados para reproduzir, em ordem de
        grandeza, achados publicados — não são coeficientes validados estatisticamente e não devem orientar decisões
        clínicas reais. O sub-modelo de cicatrização por episódio reutiliza a curva exponencial A(t)=A₀·e^(−k·t)
        calibrada por Sheehan et al. (2003).</p>
        <p>Fontes: Armstrong DG, Boulton AJM, Bus SA. <i>N Engl J Med</i> 2017;376:2367-75 · Armstrong DG et al.
        <i>J Foot Ankle Res</i> 2020;13:16 · Sheehan P et al. <i>Diabetes Care</i> 2003;26:1879-82 · Klein R et al.
        (Wisconsin Epidemiologic Study of Diabetic Retinopathy) · Hwang DJ et al. <i>PLOS ONE</i> 2017.</p>
        <p style={{ opacity: 0.7 }}>Confira as referências originais antes de usar em aula — buscas automatizadas podem conter imprecisões de citação.</p>
      </footer>
    </div>
  );
}
