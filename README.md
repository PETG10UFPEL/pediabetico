# Evolução do Pé Diabético — Simulador

Simulador educacional interativo (React + Vite) que modela, ano a ano, a
evolução de um paciente com diabetes tipo 2 — do diagnóstico até neuropatia,
doença arterial periférica, pé de risco, primeira úlcera (e suas
complicações), com uma trilha paralela de retinopatia para ilustrar o tema
macro × microvascular.

⚠️ **Uso educacional.** As magnitudes de risco foram calibradas para
reproduzir *ordens de grandeza* da literatura citada em `src/lib/simulation.js`
— não é um modelo validado estatisticamente e não deve orientar decisões
clínicas reais.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/` com um site estático (HTML+JS+CSS), sem dependência de
servidor/backend — por isso funciona tanto na Vercel quanto no Hugging Face
Spaces.

## Deploy na Vercel

1. Suba esta pasta para um repositório no GitHub (ou use `vercel` CLI direto).
2. Na Vercel: **Add New → Project → Import** o repositório.
3. Framework preset: **Vite** (detectado automaticamente).
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy. Pronto — não precisa de variáveis de ambiente nem backend.

Ou via CLI, dentro da pasta do projeto:
```bash
npm i -g vercel
vercel --prod
```

## Deploy no Hugging Face Spaces

O jeito mais simples é criar um Space do tipo **Static**, que serve
diretamente o conteúdo de `dist/`:

1. Rode `npm run build` localmente.
2. Crie um novo Space em huggingface.co/new-space, SDK = **Static**.
3. Copie o *conteúdo* da pasta `dist/` (não a pasta em si) para a raiz do
   repositório do Space — ou seja, `index.html` e `assets/` ficam na raiz.
4. Commit/push. O Space publica automaticamente.

Alternativa: Space do tipo **Docker**, servindo a pasta `dist/` com `nginx`
ou `serve` — útil se quiser manter o build acontecendo no próprio Space
(adicione um `Dockerfile` simples com `npm run build` + `npx serve dist`).

## Estrutura

```
src/
  lib/simulation.js   → motor de simulação (estado do paciente, hazards anuais,
                         sub-modelo de cicatrização por episódio, Monte Carlo)
  App.jsx             → interface: painel de parâmetros, timeline narrativa
                         de uma trajetória, e curva populacional agregada
  App.css / index.css → estilo (tema clínico escuro)
```

## Fontes citadas no modelo

- Armstrong DG, Boulton AJM, Bus SA. "Diabetic Foot Ulcers and Their
  Recurrence." *N Engl J Med.* 2017;376:2367-2375.
- Armstrong DG et al. "Five-year mortality and direct costs of care for
  people with diabetic foot complications are comparable to cancer."
  *J Foot Ankle Res.* 2020;13:16.
- Sheehan P, Jones P, Caselli A, Giurini JM, Veves A. "Percent Change in
  Wound Area of Diabetic Foot Ulcers Over a 4-Week Period Is a Robust
  Predictor of Complete Healing in a 12-Week Prospective Trial." *Diabetes
  Care.* 2003;26(6):1879-1882.
- Klein R et al. Wisconsin Epidemiologic Study of Diabetic Retinopathy
  (série de publicações sobre prevalência/progressão por tempo de diagnóstico).
- Hwang DJ et al. *PLOS ONE.* 2017 (retinopatia concomitante em úlcera de pé).

Confira os artigos originais antes de usar em aula — a pesquisa foi feita
por busca automatizada e pode conter imprecisões de citação.
