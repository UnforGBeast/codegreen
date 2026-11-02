const ratesForm = document.getElementById('rates');
const toolsList = document.getElementById('tools');

function selectPreset(preset) {
  const input = ratesForm.querySelector(`input[value="${preset}"]`);
  if (input) input.checked = true;
}

function renderTools(tools) {
  toolsList.replaceChildren(
    ...tools.map((t) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = t.label;
      const status = document.createElement('span');
      const measured = t.status === 'measured';
      status.textContent = measured ? 'Measured' : 'Not measured';
      status.className = measured ? 'measured' : 'not-measured';
      li.append(name, status);
      return li;
    })
  );
}

ratesForm.addEventListener('change', (e) => {
  if (e.target.name === 'rate') window.freshwater.setRatePreset(e.target.value);
});

window.freshwater.getRates().then((r) => selectPreset(r.preset));
window.freshwater.onSnapshot((s) => renderTools(s.tools));
