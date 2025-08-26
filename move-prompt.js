function askArmiesToMove(max, min = 0) {
  return new Promise((resolve) => {
    if (max <= 0) {
      resolve(0);
      return;
    }
    const modal = document.createElement('div');
    modal.id = 'moveArmiesModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <label>How many armies to move? (${min}-${max})</label>
        <input type="number" id="moveArmiesInput" min="${min}" max="${max}" value="${max}" />
        <button id="moveArmiesOk">OK</button>
      </div>`;
    document.body.appendChild(modal);
    modal.classList.add('show');
    const input = modal.querySelector('#moveArmiesInput');
    const btn = modal.querySelector('#moveArmiesOk');
    btn.addEventListener('click', () => {
      let count = parseInt(input.value, 10);
      if (isNaN(count)) count = min;
      count = Math.max(min, Math.min(max, count));
      modal.remove();
      resolve(count);
    });
  });
}

export default askArmiesToMove;
