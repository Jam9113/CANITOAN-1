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

// Serve frontend static files (remove if not used)
app.use(express.static(path.join(__dirname, "frontend")));

// MongoDB connection
mongoose
  .connect("mongodb://127.0.0.1:27017/payrollDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Payroll Schema and Model
const payrollSchema = new mongoose.Schema({
  employeeName: { type: String, required: true },
  RateperHour: { type: Number, required: true },
  HoursperDay: { type: Number, required: true },
  NumbersofDaysWorked: { type: Number, required: true },
  GrossSalary: { type: Number, required: true },
  Tax: { type: Number, required: true },
  Philhealth: { type: Number, required: true },
  SSS: { type: Number, required: true },
  TotalDeductions: { type: Number, required: true },
  NetSalary: { type: Number, required: true },
  payday: { type: Date, required: true },
});
const Payroll = mongoose.model("Payroll", payrollSchema);

// Employee Schema and Model
const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    position: { type: String, required: true },
    department: { type: String, required: true },
    monthlySalary: { type: Number, required: true, min: 0 },
    timeIn: { type: String, default: null },
    timeOut: { type: String, default: null },
  },
  { timestamps: true }
);
const Employee = mongoose.model("Employee", employeeSchema);

// 13th Month Pay History Schema and Model
const historySchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  pay: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});
const History = mongoose.model("History", historySchema);

// Helper to validate time in HH:mm 24-hour format
function isValidTime(timeStr) {
  if (!timeStr) return true; // allow null/undefined
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(timeStr);
}

// --- Routes ---

// Create payroll
app.post("/api/payrolls", async (req, res) => {
  try {
    const payroll = new Payroll(req.body);
    const saved = await payroll.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error saving payroll:", error);
    res.status(500).json({ error: "Failed to save payroll data." });
  }
});

// Get all payrolls
app.get("/api/payrolls", async (req, res) => {
  try {
    const payrolls = await Payroll.find();
    res.json(payrolls);
  } catch (error) {
    console.error("Error fetching payrolls:", error);
    res.status(500).json({ error: "Failed to fetch payroll data." });
  }
});

// Get all employees
app.get("/api/employees", async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees." });
  }
});

// Add employee with validation for timeIn/timeOut
app.post("/api/employees", async (req, res) => {
  try {
    const { name, position, department, monthlySalary, timeIn, timeOut } = req.body;

    if (!name || !position || !department || monthlySalary == null) {
      return res.status(400).json({
        error: "Required fields: name, position, department, monthlySalary",
      });
    }

    if (!isValidTime(timeIn)) {
      return res.status(400).json({ error: "timeIn must be HH:mm 24-hour format or empty" });
    }
    if (!isValidTime(timeOut)) {
      return res.status(400).json({ error: "timeOut must be HH:mm 24-hour format or empty" });
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
  } catch (error) {
    console.error("Error adding employee:", error);
    res.status(500).json({ error: "Failed to add employee." });
  }
});

// Calculate 13th month pay and save to history
app.post("/api/calculate", async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ error: "employeeId required" });

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    // Simple 13th month pay calc: monthlySalary / 12
    const pay = parseFloat((employee.monthlySalary / 12).toFixed(2));

    const historyEntry = new History({ employeeId: employee._id, pay });
    await historyEntry.save();

    res.json({ pay });
  } catch (error) {
    console.error("Error calculating 13th month pay:", error);
    res.status(500).json({ error: "Calculation failed." });
  }
});

// Get 13th month pay history by employeeId
app.get("/api/history/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const history = await History.find({ employeeId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch history." });
  }
});

// Fallback route for SPA (if you have frontend)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
