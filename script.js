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
