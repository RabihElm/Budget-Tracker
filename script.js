// ---------------------------------------------------------------------------
// Budget Tracker
// Plain JavaScript + localStorage. No frameworks.
// ---------------------------------------------------------------------------

// The key we'll use to store/read our data in localStorage.
// localStorage only stores strings, so we'll convert to/from JSON.
const STORAGE_KEY = "budget-tracker-transactions";

// Grab the elements from the page once, so we can reuse them.
const form = document.getElementById("transaction-form");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const listEl = document.getElementById("transaction-list");
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("total-income");
const expensesEl = document.getElementById("total-expenses");
const balanceCircleEl = document.getElementById("balance-circle");
const expensesCircleEl = document.getElementById("expenses-circle");
const meterFillEl = document.getElementById("meter-fill");
const meterPercentEl = document.getElementById("meter-percent");
const meterMessageEl = document.getElementById("meter-message");

// This array is our "source of truth" while the page is open.
// We load whatever was saved last time (or start with an empty list).
let transactions = loadTransactions();

// Read the saved transactions out of localStorage.
function loadTransactions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  // If nothing is saved yet, start with an empty array.
  return saved ? JSON.parse(saved) : [];
}

// Write the current transactions back into localStorage.
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// Turn a number into a nice "$1,234.56" string.
function formatMoney(amount) {
  return "$" + amount.toFixed(2);
}

// Redraw the whole UI from the `transactions` array.
// Keeping all rendering in one function means the screen always
// matches the data — we just call render() whenever the data changes.
function render() {
  // Clear the list, then rebuild it from scratch.
  listEl.innerHTML = "";

  let income = 0;
  let expenses = 0;

  transactions.forEach((t) => {
    // Add to the running totals.
    if (t.type === "income") {
      income += t.amount;
    } else {
      expenses += t.amount;
    }

    // Build one <li> row for this transaction.
    const li = document.createElement("li");

    const sign = t.type === "income" ? "+" : "-";
    const amountClass = t.type === "income" ? "income" : "expense";

    li.innerHTML = `
      <span class="item-desc">${t.description}</span>
      <span class="item-amount ${amountClass}">${sign}${formatMoney(t.amount)}</span>
      <button class="delete-btn" aria-label="Delete">&times;</button>
    `;

    // Wire up the delete button for this specific row.
    li.querySelector(".delete-btn").addEventListener("click", () => {
      deleteTransaction(t.id);
    });

    listEl.appendChild(li);
  });

  // Update the three summary numbers.
  incomeEl.textContent = formatMoney(income);
  expensesEl.textContent = formatMoney(expenses);
  balanceEl.textContent = formatMoney(income - expenses);

  renderCircles(income - expenses, expenses);
  renderMeter(income, expenses);
}

// Size the balance and expenses circles relative to each other.
// The larger amount gets a full-size circle; the smaller one shrinks.
function renderCircles(balance, expenses) {
  // A negative balance can't have a "negative size", so treat it as 0.
  const balanceSize = Math.max(balance, 0);
  const biggest = Math.max(balanceSize, expenses);

  // "scale" is a number from 0 to 1: 1 = full size, 0 = smallest size.
  // We use the square root so the circle's AREA matches the amount —
  // twice the money looks like twice the circle, not four times.
  let balanceScale = 1;
  let expensesScale = 1;
  if (biggest > 0) {
    balanceScale = Math.sqrt(balanceSize / biggest);
    expensesScale = Math.sqrt(expenses / biggest);
  }

  // Hand the numbers to CSS as a custom property (--scale).
  // style.css turns it into an actual width and height.
  balanceCircleEl.style.setProperty("--scale", balanceScale);
  expensesCircleEl.style.setProperty("--scale", expensesScale);
}

// Update the spending meter: how much of your income has gone to expenses.
function renderMeter(income, expenses) {
  // What percent of income has been spent? If there's no income yet,
  // any expense at all counts as 100% (you're spending money you don't have).
  let percent = 0;
  if (income > 0) {
    percent = (expenses / income) * 100;
  } else if (expenses > 0) {
    percent = 100;
  }

  // The bar can't be wider than its track, so cap the width at 100%.
  // The CSS "transition" on .meter-fill makes the width change animate.
  meterFillEl.style.width = Math.min(percent, 100) + "%";
  meterPercentEl.textContent = Math.round(percent) + "%";

  // Pick a colour level and a message based on how much is spent.
  // We swap CSS classes rather than setting colours here, so all the
  // styling stays in style.css.
  let level;
  let message;
  if (income === 0 && expenses === 0) {
    level = "low";
    message = "Add some income to see how your spending compares.";
  } else if (percent < 50) {
    level = "low";
    message = "Looking good — you've spent less than half your income.";
  } else if (percent < 80) {
    level = "medium";
    message = "Heads up — more than half your income is spent.";
  } else if (percent <= 100) {
    level = "high";
    message = "Careful — you're close to spending everything.";
  } else {
    level = "over";
    message = "You've spent " + formatMoney(expenses - income) + " more than you earned!";
  }

  meterFillEl.className = "meter-fill " + level;
  meterPercentEl.className = "meter-percent " + level;
  meterMessageEl.textContent = message;
}

// Add a new transaction when the form is submitted.
function addTransaction(event) {
  // Stop the browser from reloading the page (the default for forms).
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = parseFloat(amountInput.value);

  // Basic guard: ignore empty description or invalid/zero amounts.
  if (!description || isNaN(amount) || amount <= 0) {
    return;
  }

  // Create the transaction object. The id (current timestamp) gives us
  // a unique way to find and delete this exact row later.
  const transaction = {
    id: Date.now(),
    description: description,
    amount: amount,
    type: typeInput.value,
  };

  transactions.push(transaction);
  saveTransactions();
  render();

  // Reset the form and put the cursor back in the first field.
  form.reset();
  descriptionInput.focus();
}

// Remove a transaction by its id, then save and redraw.
function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions();
  render();
}

// Listen for the form being submitted (Add button or Enter key).
form.addEventListener("submit", addTransaction);

// Draw the initial screen using whatever was loaded from localStorage.
render();
