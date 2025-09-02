function askArmiesToMove(max, min = 0) {
  return new Promise((resolve) => {
    if (max <= 0) {
      resolve(0);
      return;
    }

    const input = window.prompt(`How many armies to move? (${min}-${max})`, String(max));

    if (input === null) {
      resolve(0);
      return;
    }

    let count = parseInt(input, 10);
    if (isNaN(count)) count = max;
    count = Math.max(min, Math.min(max, count));
    resolve(count);
  });
}

export default askArmiesToMove;
