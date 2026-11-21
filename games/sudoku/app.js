/* Sudoku UI: renders the board, handles input, and checks for a win. */
(function () {
  const Core = window.SudokuCore;

  const boardEl = document.getElementById("board");
  const difficultyEl = document.getElementById("difficulty");
  const statusEl = document.getElementById("status");

  let state = null; // { puzzle, solution, current, selected, showErrors, solved }
  let cellEls = [];

  function startNewGame() {
    const difficulty = difficultyEl.value;
    const generated = Core.generatePuzzle(difficulty);
    state = {
      puzzle: generated.puzzle,
      solution: generated.solution,
      current: generated.puzzle.slice(),
      selected: null,
      solved: false,
      clues: generated.clues,
    };
    statusEl.classList.remove("win");
    statusEl.textContent = generated.reachedTarget
      ? `New ${Core.DIFFICULTIES[difficulty].label.toLowerCase()} puzzle. Good luck!`
      : `New puzzle (${generated.clues} clues, target was ${Core.DIFFICULTIES[difficulty].clues}).`;
    render();
  }

  function restartPuzzle() {
    if (!state) return;
    state.current = state.puzzle.slice();
    state.solved = false;
    statusEl.classList.remove("win");
    statusEl.textContent = "Puzzle restarted.";
    render();
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    cellEls = [];
    for (let i = 0; i < Core.CELLS; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.index = i;
      cell.addEventListener("click", () => select(i));
      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
  }

  function render() {
    if (!state) return;
    const sel = state.selected;
    const selValue = sel !== null ? state.current[sel] : 0;

    for (let i = 0; i < Core.CELLS; i++) {
      const el = cellEls[i];
      const value = state.current[i];
      const isGiven = state.puzzle[i] !== 0;

      el.textContent = value === 0 ? "" : String(value);
      el.classList.toggle("given", isGiven);
      el.classList.toggle("wrong", state.showErrors === true && value !== 0 && value !== state.solution[i]);
      el.classList.toggle("selected", i === sel);
      el.classList.toggle(
        "related",
        sel !== null && i !== sel && (Core.rowOf(i) === Core.rowOf(sel) || Core.colOf(i) === Core.colOf(sel) || Core.boxOf(i) === Core.boxOf(sel))
      );
      el.classList.toggle("same", sel !== null && selValue !== 0 && i !== sel && value === selValue);
      el.setAttribute("aria-label", `Row ${Core.rowOf(i) + 1}, column ${Core.colOf(i) + 1}${value ? ", value " + value : ", empty"}`);
    }
  }

  function select(index) {
    if (!state) return;
    state.selected = index;
    render();
  }

  function enter(value) {
    if (!state || state.solved || state.selected === null) return;
    if (state.puzzle[state.selected] !== 0) return; // can't edit given clues
    state.current[state.selected] = value;
    state.showErrors = false;
    checkWin();
    render();
  }

  function checkWin() {
    if (state.current.every((v, i) => v === state.solution[i])) {
      state.solved = true;
      state.selected = null;
      statusEl.classList.add("win");
      statusEl.textContent = "Solved! Nice work.";
    }
  }

  function checkBoard() {
    if (!state) return;
    state.showErrors = true;
    const filled = state.current.filter((v) => v !== 0).length;
    const wrong = state.current.filter((v, i) => v !== 0 && v !== state.solution[i]).length;
    if (wrong === 0) {
      statusEl.textContent = `No mistakes so far (${filled}/81 filled).`;
    } else {
      statusEl.textContent = `${wrong} wrong number${wrong === 1 ? "" : "s"} highlighted in red.`;
    }
    render();
  }

  // Keyboard support: digits, Backspace/Delete, arrow keys.
  document.addEventListener("keydown", (e) => {
    if (!state) return;
    if (e.target.tagName === "SELECT") return;
    if (/^[1-9]$/.test(e.key)) {
      enter(Number(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      enter(0);
    } else if (e.key.startsWith("Arrow") && state.selected !== null) {
      e.preventDefault();
      let r = Core.rowOf(state.selected);
      let c = Core.colOf(state.selected);
      if (e.key === "ArrowUp") r = Math.max(0, r - 1);
      if (e.key === "ArrowDown") r = Math.min(8, r + 1);
      if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
      if (e.key === "ArrowRight") c = Math.min(8, c + 1);
      select(r * 9 + c);
    }
  });

  document.querySelectorAll("#numpad button").forEach((btn) => {
    btn.addEventListener("click", () => enter(Number(btn.dataset.value)));
  });

  document.getElementById("new-game").addEventListener("click", startNewGame);
  document.getElementById("reset").addEventListener("click", restartPuzzle);
  document.getElementById("check").addEventListener("click", checkBoard);
  difficultyEl.addEventListener("change", startNewGame);

  buildBoard();
  startNewGame();
})();
