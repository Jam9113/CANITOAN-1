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

// Serve static files from 'frontend' folder
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
const payrollSchema = new mongoose.Schema(
  {
    employeeName: { type: String, required: true },
    RateperHour: { type: Number, required: true, min: 0 },
    HoursperDay: { type: Number, required: true, min: 0 },
    NumbersofDaysWorked: { type: Number, required: true, min: 0 },
    GrossSalary: { type: Number, required: true, min: 0 },
    Tax: { type: Number, required: true, min: 0 },
    Philhealth: { type: Number, required: true, min: 0 },
    SSS: { type: Number, required: true, min: 0 },
    TotalDeductions: { type: Number, required: true, min: 0 },
    NetSalary: { type: Number, required: true, min: 0 },
    payday: { type: Date, required: true },
  },
  { timestamps: true }
);
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
  pay: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now },
});
const History = mongoose.model("History", historySchema);

// Helper function to validate time in HH:mm 24-hour format
function isValidTime(timeStr) {
  if (!timeStr) return true; // allow null/undefined
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(timeStr);
}


app.post("/api/payrolls", async (req, res) => {
  try {
    const payroll = new Payroll(req.body);
    await payroll.validate();
    const saved = await payroll.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error saving payroll:", error);
    res.status(400).json({ error: error.message || "Failed to save payroll data." });
  }
});

// Get all Payroll records
app.get("/api/payrolls", async (req, res) => {
  try {
    const payrolls = await Payroll.find();
    res.json(payrolls);
  } catch (error) {
    console.error("Error fetching payrolls:", error);
    res.status(500).json({ error: "Failed to fetch payroll data." });
  }
});

// Get all Employees
app.get("/api/employees", async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees." });
  }
});

// Add new Employee with validation for timeIn and timeOut
app.post("/api/employees", async (req, res) => {
  try {
    const { name, position, department, monthlySalary, timeIn, timeOut } = req.body;

    if (!name || !position || !department || monthlySalary == null) {
      return res.status(400).json({
        error: "All fields are required: name, position, department, monthlySalary.",
      });
    }

    if (typeof monthlySalary !== "number" || isNaN(monthlySalary) || monthlySalary < 0) {
      return res.status(400).json({ error: "monthlySalary must be a valid positive number." });
    }

    if (!isValidTime(timeIn)) {
      return res.status(400).json({ error: "timeIn must be in HH:mm 24-hour format or empty." });
    }
    if (!isValidTime(timeOut)) {
      return res.status(400).json({ error: "timeOut must be in HH:mm 24-hour format or empty." });
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

// Calculate 13th month pay and save history
app.post("/api/calculate", async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ error: "EmployeeId is required" });

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    if (
      typeof employee.monthlySalary !== "number" ||
      isNaN(employee.monthlySalary) ||
      employee.monthlySalary < 0
    ) {
      return res.status(400).json({ error: "Invalid monthlySalary for employee" });
    }

    const pay = parseFloat((employee.monthlySalary / 12).toFixed(2));

    const historyEntry = new History({
      employeeId: employee._id,
      pay,
    });
    await historyEntry.save();

    res.json({ pay });
  } catch (error) {
    console.error("Error calculating 13th month pay:", error);
    res.status(500).json({ error: "Calculation failed." });
  }
});

// Get 13th month pay calculation history for an employee
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

// Serve index.html for all other routes (for SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
