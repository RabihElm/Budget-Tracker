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
const dateInput = document.getElementById("date");
const recurringInput = document.getElementById("recurring");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const monthLabelEl = document.getElementById("month-label");
const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const listEl = document.getElementById("transaction-list");
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("total-income");
const expensesEl = document.getElementById("total-expenses");
const balanceCircleEl = document.getElementById("balance-circle");
const expensesCircleEl = document.getElementById("expenses-circle");
const meterFillEl = document.getElementById("meter-fill");
const meterPercentEl = document.getElementById("meter-percent");
const meterMessageEl = document.getElementById("meter-message");

// ----- Date helpers --------------------------------------------------------
// Dates are stored as "YYYY-MM-DD" text (e.g. "2026-11-03") and months as
// "YYYY-MM" (e.g. "2026-11"). Text in this format sorts and compares in
// date order, so "2026-09" < "2026-11" works just like comparing numbers.

// Turn a JavaScript Date into "YYYY-MM-DD" (using your local time zone).
function toDateString(date) {
  const year = date.getFullYear();
  // getMonth() counts from 0 (January = 0), so add 1.
  // padStart turns "3" into "03" so every date has the same shape.
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayString() {
  return toDateString(new Date());
}

// Move a "YYYY-MM" month forwards or backwards, e.g. ("2026-01", -1) → "2025-12".
// Date handles the year rollover for us when the month goes past 0 or 11.
function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split("-").map(Number);
  return toDateString(new Date(year, monthNumber - 1 + delta, 1)).slice(0, 7);
}

// "2026-11" → "November 2026"
function formatMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

// How many days a month has (28–31). Day 0 of the *next* month is the
// last day of this one — a handy JavaScript Date trick.
function daysInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

// ----- Data ----------------------------------------------------------------

// This array is our "source of truth" while the page is open.
// We load whatever was saved last time (or start with an empty list).
let transactions = loadTransactions();

// The month currently on screen, as "YYYY-MM". Starts on this month.
let currentMonth = todayString().slice(0, 7);

// The id of the transaction being edited, or null when the form is
// in normal "Add" mode.
let editingId = null;

// Read the saved transactions out of localStorage.
function loadTransactions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  // If nothing is saved yet, start with an empty array.
  const list = saved ? JSON.parse(saved) : [];

  // Transactions saved before this version have no date. Their id is the
  // moment they were created (from Date.now()), so we use that as the date.
  // "...t" copies all of the transaction's existing fields.
  return list.map((t) => ({
    ...t,
    date: t.date || toDateString(new Date(t.id)),
    recurring: t.recurring || false,
  }));
}

// Pick out the transactions that belong to a given month.
function transactionsForMonth(month) {
  return transactions.filter((t) => {
    const startMonth = t.date.slice(0, 7);

    // One-off transactions only appear in the month they happened.
    if (!t.recurring) {
      return startMonth === month;
    }

    // Recurring ones appear every month from their start month onward,
    // until the month they were stopped (if they've been stopped).
    return startMonth <= month && (!t.endMonth || month <= t.endMonth);
  });
}

// The day of the month a transaction lands on in a given month.
// A recurring item that started on the 31st shows on the 30th in
// 30-day months (and the 28th/29th in February).
function dayInMonth(t, month) {
  const day = Number(t.date.slice(8, 10));
  return Math.min(day, daysInMonth(month));
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
  monthLabelEl.textContent = formatMonth(currentMonth);

  let income = 0;
  let expenses = 0;

  // Only this month's transactions, sorted by day (earliest first).
  const monthTransactions = transactionsForMonth(currentMonth).sort(
    (a, b) => dayInMonth(a, currentMonth) - dayInMonth(b, currentMonth)
  );

  if (monthTransactions.length === 0) {
    listEl.innerHTML = `<li class="empty">No transactions this month.</li>`;
  }

  monthTransactions.forEach((t) => {
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

    // e.g. "Nov 3" — plus a "Monthly" tag for recurring items.
    const [year, monthNumber] = currentMonth.split("-").map(Number);
    const dateLabel = new Date(year, monthNumber - 1, dayInMonth(t, currentMonth))
      .toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const recurringTag = t.recurring ? `<span class="tag">🔁 Monthly</span>` : "";

    li.innerHTML = `
      <div class="item-info">
        <span class="item-desc">${t.description}</span>
        <span class="item-meta">${dateLabel} ${recurringTag}</span>
      </div>
      <span class="item-amount ${amountClass}">${sign}${formatMoney(t.amount)}</span>
      <button class="edit-btn" aria-label="Edit">&#9998;</button>
      <button class="delete-btn" aria-label="Delete">&times;</button>
    `;

    // Highlight the row that's currently loaded into the form.
    if (t.id === editingId) {
      li.classList.add("editing");
    }

    // Wire up the edit and delete buttons for this specific row.
    li.querySelector(".edit-btn").addEventListener("click", () => {
      startEditing(t.id);
    });
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

// Handle the form being submitted: add a new transaction, or save
// changes to the one being edited.
function handleSubmit(event) {
  // Stop the browser from reloading the page (the default for forms).
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = parseFloat(amountInput.value);

  // Basic guard: ignore empty description or invalid/zero amounts.
  if (!description || isNaN(amount) || amount <= 0) {
    return;
  }

  // Everything the form says, gathered into one object.
  const values = {
    description: description,
    amount: amount,
    type: typeInput.value,
    date: dateInput.value,
    recurring: recurringInput.checked,
  };

  if (editingId !== null) {
    saveEdit(values);
  } else {
    // A brand new transaction. The id (current timestamp) gives us
    // a unique way to find and delete this exact row later.
    transactions.push({ id: Date.now(), ...values });
  }

  saveTransactions();

  // Jump to the month the transaction is in, so you can see it.
  currentMonth = values.date.slice(0, 7);
  stopEditing();
  descriptionInput.focus();
}

// Apply the form's values to the transaction being edited.
function saveEdit(values) {
  const t = transactions.find((t) => t.id === editingId);

  if (t.recurring && t.date.slice(0, 7) < currentMonth) {
    // Editing a recurring item in a later month: earlier months should
    // keep the old version. So we stop the old one last month, and start
    // a new transaction with the new values from here on.
    const updated = { id: Date.now(), ...values };
    // If the old one was already set to stop at some point, keep that.
    if (values.recurring && t.endMonth) {
      updated.endMonth = t.endMonth;
    }
    t.endMonth = shiftMonth(currentMonth, -1);
    transactions.push(updated);
  } else {
    // Otherwise just overwrite the old values with the new ones.
    // Object.assign copies every field from `values` onto `t`.
    Object.assign(t, values);
    if (!t.recurring) {
      delete t.endMonth; // one-off items don't need a stop month
    }
  }
}

// Load a transaction into the form so it can be changed.
function startEditing(id) {
  const t = transactions.find((t) => t.id === id);
  editingId = id;

  descriptionInput.value = t.description;
  amountInput.value = t.amount;
  typeInput.value = t.type;
  recurringInput.checked = t.recurring;
  // Show the date it lands on in the month being viewed.
  const day = String(dayInMonth(t, currentMonth)).padStart(2, "0");
  dateInput.value = `${currentMonth}-${day}`;

  // Switch the form into "edit mode".
  submitBtn.textContent = "Save changes";
  cancelEditBtn.hidden = false;

  render(); // redraw so the row gets highlighted
  amountInput.focus();
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Put the form back into normal "Add" mode and redraw.
function stopEditing() {
  editingId = null;
  form.reset();
  setDefaultDate();
  submitBtn.textContent = "Add";
  cancelEditBtn.hidden = true;
  render();
}

// Remove a transaction by its id, then save and redraw.
function deleteTransaction(id) {
  // Deleting the row you're editing? Leave edit mode first.
  if (id === editingId) {
    stopEditing();
  }

  const t = transactions.find((t) => t.id === id);

  if (t.recurring && t.date.slice(0, 7) < currentMonth) {
    // Deleting a recurring item in a later month just stops it from this
    // month on — earlier months keep their history.
    t.endMonth = shiftMonth(currentMonth, -1);
  } else {
    // A one-off item (or a recurring one in its first month) is removed entirely.
    transactions = transactions.filter((t) => t.id !== id);
  }

  saveTransactions();
  render();
}

// Pre-fill the form's date: today if we're viewing this month,
// otherwise the 1st of the month on screen.
function setDefaultDate() {
  const today = todayString();
  dateInput.value = today.startsWith(currentMonth) ? today : currentMonth + "-01";
}

// Move the view one month back or forward.
// Any edit in progress is cancelled, since it belonged to the old month.
function changeMonth(delta) {
  currentMonth = shiftMonth(currentMonth, delta);
  stopEditing();
}

// Listen for the form being submitted (Add button or Enter key).
form.addEventListener("submit", handleSubmit);
cancelEditBtn.addEventListener("click", stopEditing);
prevMonthBtn.addEventListener("click", () => changeMonth(-1));
nextMonthBtn.addEventListener("click", () => changeMonth(1));

// Draw the initial screen using whatever was loaded from localStorage.
setDefaultDate();
render();
