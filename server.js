const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (e.g., HTML frontend)
app.use(express.static(path.join(__dirname, "frontend")));

// MongoDB connection
mongoose
  .connect("mongodb://127.0.0.1:27017/payrollDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// SCHEMAS & MODELS

// Payroll
const payrollSchema = new mongoose.Schema({
  employeeName: String,
  RateperHour: Number,
  HoursperDay: Number,
  NumbersofDaysWorked: Number,
  GrossSalary: Number,
  Tax: Number,
  Philhealth: Number,
  SSS: Number,
  TotalDeductions: Number,
  NetSalary: Number,
});
const Payroll = mongoose.model("Payroll", payrollSchema);

// Employee
const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    position: { type: String, required: true },
    department: { type: String, required: true },
    monthlySalary: { type: Number, required: true },
    timeIn: { type: String, default: null },
    timeOut: { type: String, default: null },
  },
  { timestamps: true }
);
const Employee = mongoose.model("Employee", employeeSchema);

// 13th Month Pay History
const historySchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  pay: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});
const History = mongoose.model("History", historySchema);

// Validate time (HH:mm 24-hr format)
function isValidTime(timeStr) {
  if (!timeStr) return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
}

// ROUTES

// Create Payroll
app.post("/api/payrolls", async (req, res) => {
  try {
    const payroll = new Payroll(req.body);
    const saved = await payroll.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Error saving payroll:", err);
    res.status(500).json({ error: "Failed to save payroll." });
  }
});

// Get All Payrolls
app.get("/api/payrolls", async (req, res) => {
  try {
    const payrolls = await Payroll.find();
    res.json(payrolls);
  } catch (err) {
    console.error("❌ Error fetching payrolls:", err);
    res.status(500).json({ error: "Failed to fetch payrolls." });
  }
});

// Create Employee
app.post("/api/employees", async (req, res) => {
  try {
    const { name, position, department, monthlySalary, timeIn, timeOut } = req.body;
    if (!name || !position || !department || monthlySalary == null) {
      return res.status(400).json({ error: "Missing required employee fields." });
    }
    if (!isValidTime(timeIn) || !isValidTime(timeOut)) {
      return res.status(400).json({ error: "Invalid time format (HH:mm)." });
    }
    const newEmployee = new Employee({
      name,
      position,
      department,
      monthlySalary,
      timeIn: timeIn || null,
      timeOut: timeOut || null,
    });
    const savedEmployee = await newEmployee.save();
    res.status(201).json(savedEmployee);
  } catch (err) {
    console.error("❌ Error creating employee:", err);
    res.status(500).json({ error: "Failed to create employee." });
  }
});

// Get All Employees
app.get("/api/employees", async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (err) {
    console.error("❌ Error fetching employees:", err);
    res.status(500).json({ error: "Failed to fetch employees." });
  }
});

// Calculate 13th Month Pay
app.post("/api/calculate", async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ error: "Employee ID is required." });

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found." });

    const pay = parseFloat((employee.monthlySalary / 12).toFixed(2));

    const historyEntry = new History({ employeeId, pay });
    await historyEntry.save();

    res.json({ pay });
  } catch (err) {
    console.error("❌ Error calculating 13th month pay:", err);
    res.status(500).json({ error: "Failed to calculate 13th month pay." });
  }
});

// Get 13th Month History for Employee
app.get("/api/history/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const history = await History.find({ employeeId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    console.error("❌ Error fetching history:", err);
    res.status(500).json({ error: "Failed to fetch history." });
  }
});

// Serve frontend index.html for other routes (optional)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
