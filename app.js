const labels = ['Regular', 'Suficiente', 'Bom', 'Ótimo'];
const styles = ['regular', 'suficiente', 'bom', 'otimo'];
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const $ = id => document.getElementById(id);
const totalOf = row => row.counts.reduce((total, count) => total + count, 0);
const goodOf = row => row.counts[2] + row.counts[3];
const shareOf = row => totalOf(row) ? 100 * goodOf(row) / totalOf(row) : null;
const percent = value => value === null ? '—' : `${decimal.format(value)}%`;
const periodLabel = period => `${period.at(-1)}º quad. ${period.slice(0, 4)}`;
const monthLabel = period => `${period.slice(4)}/${period.slice(0, 4)}`;

function element(tag, content = '', attributes = {}) {
  const item = document.createElement(tag);
  if (content !== '') item.textContent = content;
  for (const [name, value] of Object.entries(attributes)) item.setAttribute(name, value);
  return item;
}

function makeLegend() {
  return labels.map((label, i) => {
    const item = element('span');
    item.append(element('i', '', { class: `swatch ${styles[i]}` }), label);
    return item;
  });
}

function trendRow(row, selectedPeriod) {
  const item = element('div', '', { class: `period-row${row.period === selectedPeriod ? ' current' : ''}` });
  const caption = element('div', '', { class: 'period-label' });
  caption.append(element('strong', periodLabel(row.period)), element('b', `${percent(shareOf(row))} Bom ou Ótimo`));
  const bar = element('div', '', { class: 'stacked', role: 'img',
    'aria-label': labels.map((label, i) => `${label}: ${row.counts[i]}`).join(', ') });
  for (const [i, count] of row.counts.entries()) {
    if (!count) continue;
    const part = element('span', '', { class: `segment ${styles[i]}`, title: `${labels[i]}: ${count} equipes` });
    part.style.width = `${100 * count / totalOf(row)}%`;
    bar.append(part);
  }
  item.append(caption, bar);
  return item;
}

function makeTable(series) {
  const table = element('table', '', { 'aria-label': 'Contagem de equipes por quadrimestre e conceito' });
  const header = table.createTHead().insertRow();
  for (const title of ['Período', ...labels, 'Total']) header.append(element('th', title, { scope: 'col' }));
  const body = table.createTBody();
  for (const row of series) {
    const tr = body.insertRow();
    tr.append(element('th', periodLabel(row.period), { scope: 'row' }));
    for (const count of [...row.counts, totalOf(row)]) tr.append(element('td', integer.format(count)));
  }
  return table;
}

function makeComparison(quality, indicators, period, selected, change) {
  const options = quality.filter(row => row.period === period)
    .sort((a, b) => (shareOf(b) ?? -1) - (shareOf(a) ?? -1) || a.indicator.localeCompare(b.indicator));
  return options.map(row => {
    const label = indicators.get(row.indicator).label;
    const share = shareOf(row);
    const button = element('button', '', {
      type: 'button', class: 'indicator-row', 'aria-pressed': String(row.indicator === selected),
      'aria-label': `${row.indicator} ${label}, ${percent(share)} Bom ou Ótimo`
    });
    const name = element('span');
    name.append(element('strong', row.indicator), ` · ${label}`);
    const bar = element('span', '', { class: 'mini', 'aria-hidden': 'true' });
    const inner = element('i');
    inner.style.width = `${share ?? 0}%`;
    bar.append(inner);
    button.append(name, bar, element('output', percent(share), { 'aria-hidden': 'true' }));
    button.addEventListener('click', () => change(row.indicator));
    return button;
  });
}

function loadDashboard(data) {
  const indicators = new Map(data.indicators.map(item => [item.id, item]));
  const periods = [...new Set(data.quality.map(row => row.period))].sort();
  const latest = periods.at(-1);
  const preferred = 'C1';
  if (!latest || !indicators.has(preferred)) throw new Error('Base sem recorte inicial.');
  const periodSelect = $('period');
  const indicatorSelect = $('indicator');
  const reset = $('reset');
  const query = new URL(location.href).searchParams;
  periodSelect.replaceChildren(...[...periods].reverse().map(period => new Option(periodLabel(period), period)));
  indicatorSelect.replaceChildren(...[...indicators.values()].sort((a,b)=>a.id.localeCompare(b.id))
    .map(item => new Option(`${item.id} · ${item.label}`, item.id)));
  periodSelect.value = periods.includes(query.get('periodo')) ? query.get('periodo') : latest;
  indicatorSelect.value = indicators.has(query.get('indicador')) ? query.get('indicador') : preferred;
  $('latest').textContent = periodLabel(latest);
  $('preliminary').hidden = !data.preliminary;
  $('legend').replaceChildren(...makeLegend());
  $('ctx-attendance').textContent = integer.format(data.context.attendance.value);
  $('ctx-attendance-note').textContent = `SIAPS · ${monthLabel(data.context.attendance.period)}`;
  $('ctx-population').textContent = integer.format(data.context.population.value);
  $('ctx-population-note').textContent = `IBGE · ${data.context.population.period}`;
  $('provenance').textContent = `Export oficial gerado em ${data.extracted.replace(' - ', ', ')}. Recorte municipal de Ibirité (MG), somente equipes eSF elegíveis na avaliação. A série mostra os quadrimestres presentes no arquivo, com possibilidade de reprocessamento pelo SIAPS.`;

  function render(updateUrl) {
    const period = periodSelect.value;
    const indicator = indicatorSelect.value;
    const label = indicators.get(indicator).label;
    const series = data.quality.filter(row => row.indicator === indicator);
    const rowIndex = series.findIndex(row => row.period === period);
    const selected = series[rowIndex];
    const previous = series[rowIndex - 1];
    const share = shareOf(selected);
    const prior = previous ? shareOf(previous) : null;
    const difference = share !== null && prior !== null ? share - prior : null;
    $('selection').textContent = `${periodLabel(period)} · ${indicator} ${label}`;
    $('kpi-total').textContent = integer.format(totalOf(selected));
    $('kpi-total-note').textContent = 'Equipes classificadas neste indicador';
    $('kpi-share').textContent = percent(share);
    $('kpi-share-note').textContent = `${integer.format(goodOf(selected))} de ${integer.format(totalOf(selected))} equipes`;
    $('kpi-delta').textContent = difference === null ? '—' : `${signed.format(difference)} p.p.`;
    $('kpi-delta-note').textContent = previous ? `Ante o ${periodLabel(previous.period)}` : 'Primeiro quadrimestre da série';
    $('trend-note').textContent = `${indicator} · ${label} · quadrimestres disponíveis`;
    $('trend').replaceChildren(...series.map(row => trendRow(row, period)));
    $('table').replaceChildren(makeTable(series));
    $('comparison').replaceChildren(...makeComparison(data.quality, indicators, period, indicator, next => {
      indicatorSelect.value = next;
      render(true);
      $('comparison').querySelector('[aria-pressed="true"]').focus();
    }));
    const outcome = share === null ? 'Sem equipes classificadas no recorte.' :
      `No ${periodLabel(period)}, ${goodOf(selected)} de ${totalOf(selected)} equipes ficaram em Bom ou Ótimo para ${label.toLocaleLowerCase('pt-BR')}.`;
    $('finding').textContent = difference === null ? outcome :
      `${outcome} Na avaliação anterior, eram ${goodOf(previous)} de ${totalOf(previous)}.`;
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('periodo', period);
      url.searchParams.set('indicador', indicator);
      history.replaceState(null, '', url);
    }
  }

  for (const control of [periodSelect, indicatorSelect]) {
    control.disabled = false;
    control.addEventListener('change', () => render(true));
  }
  reset.disabled = false;
  reset.addEventListener('click', () => {
    periodSelect.value = latest;
    indicatorSelect.value = preferred;
    render(true);
  });
  render(false);
  $('load-status').textContent = '';
  $('report').hidden = false;
}

try {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  loadDashboard(await response.json());
} catch (error) {
  $('load-status').textContent = 'A base pública não pôde ser carregada. Atualize a página para tentar novamente.';
  console.error(error);
}
