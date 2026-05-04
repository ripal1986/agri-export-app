"use client";

import { useState, useEffect } from "react";
import { Save, Camera, Printer, Share2, List, PlusCircle, X, Settings, UserCircle, CheckCircle, Clock } from "lucide-react";
import "./globals.css";

export default function Home() {
  const [role, setRole] = useState(null); // 'helper' or 'admin'
  const [adminPin, setAdminPin] = useState("");
  
  const [activeTab, setActiveTab] = useState("new"); // helper: new, recent | admin: pending, completed, settings
  const [recentEntries, setRecentEntries] = useState([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Settings state
  const [voucherSettings, setVoucherSettings] = useState({
    start: 10001,
    end: 10100,
    current: 10001,
    bankName: "SBI", // Default bank name
  });

  // Entry Form State
  const initialForm = {
    date: new Date().toISOString().split("T")[0],
    farmerName: "",
    mobileNumber: "",
    variety: "TaG24",
    customVariety: "",
    netWeight: "",
    deductionGrams: "1500",
    purchaseRate: "",
  };
  const [formData, setFormData] = useState(initialForm);
  const [parchiPhoto, setParchiPhoto] = useState(null);
  const [gatepassPhoto, setGatepassPhoto] = useState(null);
  
  // Admin Approval State
  const [editingEntry, setEditingEntry] = useState(null); // The row being approved
  const [paymentData, setPaymentData] = useState({
    cashAmount: "",
    chequeAmount: "",
    chequeNumber: ""
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null); 

  useEffect(() => {
    const savedSettings = localStorage.getItem("voucherSettings");
    if (savedSettings) {
      setVoucherSettings(JSON.parse(savedSettings));
    }
  }, []);

  useEffect(() => {
    if (activeTab === "recent" || activeTab === "pending" || activeTab === "completed") {
      fetchRecentEntries();
    }
  }, [activeTab]);

  const fetchRecentEntries = async () => {
    setIsLoadingRecent(true);
    try {
      const res = await fetch('/api/sheets/read');
      const data = await res.json();
      if (data.success) {
        setRecentEntries(data.data);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoadingRecent(false);
  };

  const handleAdminLogin = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (adminPin.trim() === "1234") {
      setRole("admin");
      setActiveTab("pending");
    } else {
      alert("ખોટો પિન!");
    }
  };

  const netWeight = parseFloat(formData.netWeight) || 0;
  const deductionGrams = parseFloat(formData.deductionGrams) || 0;
  const totalDeduction = (netWeight / 35.0) * (deductionGrams / 1000);
  const finalWeight = netWeight - totalDeduction;
  const purchaseRate = parseFloat(formData.purchaseRate) || 0;
  const finalAmount = Math.round((finalWeight / 20.0) * purchaseRate);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "cashAmount") {
        const cash = parseFloat(value) || 0;
        // Auto calculate cheque amount
        newData.chequeAmount = cash > 0 ? Math.max(0, finalAmount - cash).toString() : "";
      }
      return newData;
    });
  };

  const handlePhotoCapture = (e, setPhotoFunc) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => setPhotoFunc({ base64: reader.result, file: file });
  };

  const uploadPhoto = async (photoObj, type) => {
    if (!photoObj) return null;
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: photoObj.base64, filename: `${type}_${photoObj.file.name}` })
      });
      const result = await response.json();
      if (result.success) return result.url;
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleScanParchi = async () => {
    if (!parchiPhoto) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/ocr-groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: parchiPhoto.base64 })
      });
      const data = await res.json();
      if (data.success && data.netWeight) {
        setFormData(prev => ({ ...prev, netWeight: data.netWeight }));
        alert("OCR સફળ! વજન: " + data.netWeight + " kg");
      } else {
        alert("OCR નિષ્ફળ: ફોટામાંથી વજન મળ્યું નહિ.");
      }
    } catch (e) {
      alert("OCR એરર: " + e.message);
    }
    setIsScanning(false);
  };

  // HELPER SUBMIT
  const handleHelperSubmit = async (e) => {
    e.preventDefault();
    if (voucherSettings.current > voucherSettings.end) return;
    setIsProcessing(true);

    try {
      const parchiUrl = await uploadPhoto(parchiPhoto, 'parchi');
      const gatepassUrl = await uploadPhoto(gatepassPhoto, 'gatepass');
      const actualVariety = formData.variety === "Other" ? formData.customVariety : formData.variety;

      const todayString = formData.date.replace(/-/g, ""); 
      const dailyKey = `dailySeq_${todayString}`;
      const currentDailyNum = parseInt(localStorage.getItem(dailyKey) || "0", 10) + 1;
      const dailyPurchaseId = `PUR-${todayString}-${currentDailyNum.toString().padStart(3, '0')}`;

      const payload = {
        ...formData,
        voucherId: voucherSettings.current.toString(),
        dailyPurchaseId: dailyPurchaseId,
        variety: actualVariety,
        netWeight,
        totalDeduction: totalDeduction.toFixed(2),
        finalWeight: finalWeight.toFixed(2),
        finalAmount,
        parchiPhotoUrl: parchiUrl,
        gatepassPhotoUrl: gatepassUrl,
        status: "Pending", // Helper entries are pending
        mobileNumber: formData.mobileNumber
      };

      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.success) {
        localStorage.setItem(dailyKey, currentDailyNum.toString());
        const newSettings = { ...voucherSettings, current: voucherSettings.current + 1 };
        setVoucherSettings(newSettings);
        localStorage.setItem("voucherSettings", JSON.stringify(newSettings));

        alert("એન્ટ્રી સફળતાપૂર્વક થઈ ગઈ છે! હવે એડમિન તેને ચેક કરશે.");
        setFormData(initialForm);
        setParchiPhoto(null);
        setGatepassPhoto(null);
      } else {
        alert("સેવ કરવામાં ભૂલ: " + result.error);
      }
    } catch (error) {
      console.error(error);
      alert("નેટવર્ક એરર");
    } finally {
      setIsProcessing(false);
    }
  };

  // ADMIN APPROVE SUBMIT
  const handleAdminApprove = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const actualVariety = formData.variety === "Other" ? formData.customVariety : formData.variety;
      
      const finalChequeNum = paymentData.chequeNumber ? 
        (voucherSettings.bankName ? `${voucherSettings.bankName} - ${paymentData.chequeNumber}` : paymentData.chequeNumber) 
        : "";

      const payload = {
        rowIndex: editingEntry.rowIndex,
        voucherId: editingEntry.voucherId,
        date: formData.date,
        dailyPurchaseId: editingEntry.dailyPurchaseId,
        farmerName: formData.farmerName,
        variety: actualVariety,
        netWeight,
        deductionGrams,
        totalDeduction: totalDeduction.toFixed(2),
        finalWeight: finalWeight.toFixed(2),
        purchaseRate,
        finalAmount,
        parchiPhotoUrl: editingEntry.parchiPhotoUrl,
        gatepassPhotoUrl: editingEntry.gatepassPhotoUrl,
        status: "Completed",
        cashAmount: paymentData.cashAmount,
        chequeAmount: paymentData.chequeAmount,
        chequeNumber: finalChequeNum,
        mobileNumber: formData.mobileNumber
      };

      const response = await fetch('/api/sheets/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.success) {
        setLastSavedData(payload);
        setShowInvoiceModal(true);
        setEditingEntry(null);
        fetchRecentEntries();
      } else {
        alert("અપ્રુવ કરવામાં ભૂલ: " + result.error);
      }
    } catch (error) {
      console.error(error);
      alert("નેટવર્ક એરર");
    } finally {
      setIsProcessing(false);
    }
  };

  const openApprovalModal = (entry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      farmerName: entry.farmerName,
      mobileNumber: entry.mobileNumber || "",
      variety: entry.variety,
      customVariety: "",
      netWeight: entry.netWeight,
      deductionGrams: entry.deductionGrams || "1500",
      purchaseRate: entry.purchaseRate,
    });
    setPaymentData({
      cashAmount: "",
      chequeAmount: "",
      chequeNumber: ""
    });
  };

  // --- RENDERING ---

  if (role === null) {
    return (
      <main style={{ padding: "2rem", maxWidth: "400px", margin: "10vh auto" }} className="app-container glass-panel animate-fade-in">
        <h1 style={{ textAlign: "center", color: "var(--primary)", marginBottom: "2rem" }}>કોણ વાપરી રહ્યું છે?</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button type="button" className="btn btn-primary" style={{ padding: "1.5rem", fontSize: "1.2rem" }} onClick={() => setRole("helper")}>
            <UserCircle /> હું મેનેજર (Manager) છું
          </button>
          
          <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
            <label className="form-label">એડમિન પિન (PIN)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input type="password" placeholder="1234" value={adminPin} onChange={e => setAdminPin(e.target.value)} className="form-input" required />
              <button type="button" onClick={handleAdminLogin} className="btn btn-success">Login</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "1rem", maxWidth: "800px", margin: "0 auto", width: "100%" }} className="app-container">
      
      {/* HEADER & TABS */}
      <header className="hide-on-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", color: "var(--primary)" }}>મગફળી પર્ચેઝ ({role === 'admin' ? 'એડમિન' : 'મેનેજર'})</h1>
        <button onClick={() => setRole(null)} className="btn btn-outline" style={{ padding: "0.5rem 1rem" }}>Logout</button>
      </header>

      <div className="hide-on-print" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto" }}>
        {role === "helper" && (
          <>
            <button onClick={() => setActiveTab("new")} className={`btn ${activeTab === "new" ? "btn-primary" : "btn-outline"}`} style={{ flex: 1 }}>નવી એન્ટ્રી</button>
            <button onClick={() => setActiveTab("recent")} className={`btn ${activeTab === "recent" ? "btn-primary" : "btn-outline"}`} style={{ flex: 1 }}>જૂની એન્ટ્રીઓ</button>
          </>
        )}
        {role === "admin" && (
          <>
            <button onClick={() => setActiveTab("pending")} className={`btn ${activeTab === "pending" ? "btn-primary" : "btn-outline"}`} style={{ flex: 1 }}>બાકી (Pending)</button>
            <button onClick={() => setActiveTab("completed")} className={`btn ${activeTab === "completed" ? "btn-primary" : "btn-outline"}`} style={{ flex: 1 }}>ફાઈનલ (Completed)</button>
            <button onClick={() => setActiveTab("settings")} className={`btn ${activeTab === "settings" ? "btn-primary" : "btn-outline"}`} style={{ flex: 1 }}><Settings size={18} /></button>
          </>
        )}
      </div>

      {/* HELPER: NEW ENTRY */}
      {role === "helper" && activeTab === "new" && (
        <div className="glass-panel animate-fade-in hide-on-print" style={{ padding: "1.5rem" }}>
          <form onSubmit={handleHelperSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">વાઉચર નંબર (Auto)</label>
                <input type="text" className="form-input" value={voucherSettings.current} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">તારીખ</label>
                <input type="date" className="form-input" name="date" value={formData.date} onChange={handleInputChange} required />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
              <div className="form-group">
                <label className="form-label">ખેડૂતનું નામ</label>
                <input type="text" className="form-input" name="farmerName" value={formData.farmerName} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">મોબાઈલ નંબર</label>
                <input type="tel" className="form-input" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} placeholder="10 આંકડા" />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="form-label">જાત</label>
              <select className="form-input" name="variety" value={formData.variety} onChange={handleInputChange}>
                <option value="TaG24">TaG24</option>
                <option value="G20">G20</option>
                <option value="TJ37">TJ37</option>
                <option value="BT32">BT32</option>
                <option value="Other">બીજી (Other)</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
              <div className="form-group">
                <label className="form-label">વજન (Weighbridge)</label>
                <input type="number" step="0.01" className="form-input" name="netWeight" value={formData.netWeight} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">કપાત (ગ્રામમાં)</label>
                <input type="number" className="form-input" name="deductionGrams" value={formData.deductionGrams} onChange={handleInputChange} required />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="form-label">ભાવ (૨૦ કિલો / મણ)</label>
              <input type="number" className="form-input" name="purchaseRate" value={formData.purchaseRate} onChange={handleInputChange} required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.5rem" }}>
              <div className="form-group" style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                <label className="form-label">પર્ચી ફોટો</label>
                <label className="btn btn-outline" style={{ display: "inline-flex", cursor: "pointer", width: "100%" }}>
                  <Camera size={18} /> {parchiPhoto ? "બદલો" : "પાડો"}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handlePhotoCapture(e, setParchiPhoto)} />
                </label>
                {parchiPhoto && (
                  <button type="button" onClick={handleScanParchi} disabled={isScanning} className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem", padding: "0.5rem", fontSize: "0.9rem" }}>
                    {isScanning ? "સ્કેનિંગ ચાલુ છે..." : "વજન સ્કેન કરો (AI OCR)"}
                  </button>
                )}
              </div>
              <div className="form-group" style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                <label className="form-label">ગેટપાસ</label>
                <label className="btn btn-outline" style={{ display: "inline-flex", cursor: "pointer", width: "100%" }}>
                  <Camera size={18} /> {gatepassPhoto ? "બદલો" : "પાડો"}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handlePhotoCapture(e, setGatepassPhoto)} />
                </label>
              </div>
            </div>

            <div className="glass-panel" style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(16, 185, 129, 0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>ફાઈનલ વજન: <strong>{finalWeight.toFixed(2)} kg</strong></span>
                <span style={{ color: "var(--success)" }}><strong>₹ {finalAmount.toLocaleString('en-IN')}</strong></span>
              </div>
            </div>

            <button type="submit" className="btn btn-success" style={{ width: "100%", marginTop: "1.5rem", padding: "1rem" }} disabled={isProcessing}>
              <Save /> {isProcessing ? "પ્રોસેસિંગ..." : "સેવ કરો (Admin ને મોકલો)"}
            </button>
          </form>
        </div>
      )}

      {/* ADMIN OR HELPER: LIST TABS */}
      {["recent", "pending", "completed"].includes(activeTab) && (
        <div className="glass-panel animate-fade-in hide-on-print" style={{ padding: "1.5rem" }}>
          <h2 style={{ marginBottom: "1rem", color: "var(--primary)" }}>લિસ્ટ</h2>
          
          {isLoadingRecent ? <p>લોડ થઈ રહ્યું છે...</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {recentEntries
                .filter(entry => {
                  if (activeTab === "pending") return entry.status === "Pending";
                  if (activeTab === "completed") return entry.status === "Completed";
                  return true; // "recent" shows all for helper
                })
                .map((entry, idx) => (
                <div key={idx} style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "8px", border: `1px solid ${entry.status === 'Completed' ? 'var(--success)' : 'var(--danger)'}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: "bold" }}>{entry.voucherId}</span>
                    <span style={{ fontSize: "0.9rem" }}>{entry.status === 'Pending' ? <span style={{color: "var(--danger)"}}>બાકી</span> : <span style={{color: "var(--success)"}}>ફાઈનલ</span>}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div>{entry.farmerName} <small>({entry.variety})</small></div>
                      <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>વજન: {entry.finalWeight}kg | ₹{Number(entry.finalAmount).toLocaleString()}</div>
                    </div>
                    {role === "admin" && entry.status === "Pending" && (
                      <button onClick={() => openApprovalModal(entry)} className="btn btn-primary" style={{ padding: "0.5rem" }}>
                        અપ્રુવ કરો
                      </button>
                    )}
                    {entry.status === "Completed" && (
                      <button onClick={() => { setLastSavedData(entry); setShowInvoiceModal(true); }} className="btn btn-outline" style={{ padding: "0.5rem" }}>
                        <Printer size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADMIN: APPROVAL MODAL */}
      {editingEntry && (
        <div className="modal-overlay">
          <div className="glass-panel animate-fade-in" style={{ padding: "1.5rem", maxWidth: "500px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h2 style={{ color: "var(--primary)" }}>ચેક અને અપ્રુવ કરો</h2>
              <button onClick={() => setEditingEntry(null)} className="btn btn-outline" style={{ padding: "0.5rem" }}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleAdminApprove}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group"><label className="form-label">ખેડૂત</label><input type="text" className="form-input" name="farmerName" value={formData.farmerName} onChange={handleInputChange} required /></div>
                <div className="form-group"><label className="form-label">મોબાઈલ નં.</label><input type="tel" className="form-input" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} /></div>
                <div className="form-group"><label className="form-label">વજન (કિલો)</label><input type="number" step="0.01" className="form-input" name="netWeight" value={formData.netWeight} onChange={handleInputChange} required /></div>
                <div className="form-group"><label className="form-label">કપાત (ગ્રામ)</label><input type="number" className="form-input" name="deductionGrams" value={formData.deductionGrams} onChange={handleInputChange} required /></div>
                <div className="form-group" style={{ gridColumn: "span 2" }}><label className="form-label">ભાવ</label><input type="number" className="form-input" name="purchaseRate" value={formData.purchaseRate} onChange={handleInputChange} required /></div>
              </div>

              <div style={{ padding: "1rem", background: "rgba(16, 185, 129, 0.1)", marginBottom: "1.5rem", borderRadius: "8px" }}>
                <span>ફાઈનલ રકમ: <strong style={{ fontSize: "1.4rem", color: "var(--success)" }}>₹ {finalAmount.toLocaleString('en-IN')}</strong></span>
              </div>

              {/* PAYMENT SECTION */}
              <h3 style={{ borderBottom: "1px solid var(--surface-border)", paddingBottom: "0.5rem", marginBottom: "1rem", color: "var(--text-main)" }}>પેમેન્ટ વિગતો</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">રોકડ (Cash)</label>
                  <input type="number" className="form-input" name="cashAmount" value={paymentData.cashAmount} onChange={handlePaymentChange} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">ચેક (Cheque Amt)</label>
                  <input type="number" className="form-input" name="chequeAmount" value={paymentData.chequeAmount} onChange={handlePaymentChange} placeholder="0" />
                </div>
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">ચેક નંબર {voucherSettings.bankName && `(${voucherSettings.bankName})`}</label>
                  <input type="text" className="form-input" name="chequeNumber" value={paymentData.chequeNumber} onChange={handlePaymentChange} placeholder="દા.ત. 123456" />
                </div>
              </div>

              <button type="submit" className="btn btn-success" style={{ width: "100%", marginTop: "1.5rem" }} disabled={isProcessing}>
                {isProcessing ? "પ્રોસેસિંગ..." : "પેમેન્ટ સેવ કરો અને ફાઈનલ કરો"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN: SETTINGS */}
      {role === "admin" && activeTab === "settings" && (
        <div className="glass-panel animate-fade-in hide-on-print" style={{ padding: "1.5rem" }}>
          <h2 style={{ marginBottom: "1.5rem", fontSize: "1.2rem", color: "var(--primary)" }}>વાઉચર સિરીઝ સેટિંગ્સ</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            const newSettings = { start: parseInt(voucherSettings.start, 10), end: parseInt(voucherSettings.end, 10), current: parseInt(voucherSettings.start, 10), bankName: voucherSettings.bankName };
            setVoucherSettings(newSettings);
            localStorage.setItem("voucherSettings", JSON.stringify(newSettings));
            alert("સેટિંગ્સ સેવ થઈ ગયા છે!");
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">શરૂઆત</label><input type="number" className="form-input" value={voucherSettings.start} onChange={(e) => setVoucherSettings({...voucherSettings, start: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">અંત</label><input type="number" className="form-input" value={voucherSettings.end} onChange={(e) => setVoucherSettings({...voucherSettings, end: e.target.value})} required /></div>
            </div>
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="form-label">ડિફૉલ્ટ બેંકનું નામ (Default Bank)</label>
              <input type="text" className="form-input" value={voucherSettings.bankName} onChange={(e) => setVoucherSettings({...voucherSettings, bankName: e.target.value})} placeholder="દા.ત. SBI" />
            </div>
            <button type="submit" className="btn btn-success" style={{ width: "100%", marginTop: "1.5rem" }}>સેટિંગ્સ સેવ કરો</button>
          </form>
        </div>
      )}

      {/* INVOICE MODAL (Overlay) */}
      {showInvoiceModal && lastSavedData && (
        <div className="modal-overlay">
          <div className="glass-panel print-panel modal-content" style={{ padding: "2rem", maxWidth: "400px", width: "90%", margin: "0 auto", position: "relative" }}>
            <button className="hide-on-print" onClick={() => setShowInvoiceModal(false)} style={{ position: "absolute", right: "1rem", top: "1rem", background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}><X size={24} /></button>

            <div style={{ textAlign: "center", marginBottom: "1.5rem", borderBottom: "2px dashed #ccc", paddingBottom: "1rem" }}>
              <h1 style={{ fontSize: "2rem", fontWeight: "900", marginBottom: "0.2rem", color: "black", letterSpacing: "1px" }} className="print-dark">DARSHAN SEEDS</h1>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", color: "#444" }} className="print-dark">ખરીદી બિલ</h3>
              <p style={{ color: "var(--primary)", fontSize: "0.8rem", marginTop: "0.2rem" }} className="print-dark">PUR ID: {lastSavedData.dailyPurchaseId}</p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}><span className="print-dark">વાઉચર નં:</span><strong className="print-dark">{lastSavedData.voucherId}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}><span className="print-dark">તારીખ:</span><strong className="print-dark">{lastSavedData.date}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}><span className="print-dark">ખેડૂતનું નામ:</span><strong className="print-dark">{lastSavedData.farmerName}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}><span className="print-dark">જાત:</span><strong className="print-dark">{lastSavedData.variety}</strong></div>

            <div style={{ borderTop: "1px dashed #ccc", paddingTop: "0.5rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span className="print-dark">વજન (Weight):</span><strong className="print-dark">{lastSavedData.finalWeight} kg</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span className="print-dark">ભાવ (૨૦ કિલો):</span><strong className="print-dark">₹ {lastSavedData.purchaseRate}</strong></div>
            </div>

            <div style={{ borderTop: "2px solid #ccc", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="print-dark" style={{ fontSize: "1.2rem", fontWeight: "bold" }}>કુલ રકમ:</span>
              <strong className="print-dark" style={{ fontSize: "1.5rem", color: "var(--success)" }}>₹ {Number(lastSavedData.finalAmount).toLocaleString('en-IN')}</strong>
            </div>

            {/* Payment Info Print */}
            {(lastSavedData.cashAmount || lastSavedData.chequeAmount) && (
              <div style={{ borderTop: "1px dashed #ccc", paddingTop: "0.5rem", marginTop: "0.5rem", fontSize: "0.9rem" }}>
                <p className="print-dark" style={{fontWeight: "bold", marginBottom: "0.2rem"}}>પેમેન્ટ વિગત:</p>
                {lastSavedData.cashAmount && <div style={{display: "flex", justifyContent: "space-between"}}><span className="print-dark">રોકડ:</span><span className="print-dark">₹ {lastSavedData.cashAmount}</span></div>}
                {lastSavedData.chequeAmount && <div style={{display: "flex", justifyContent: "space-between"}}><span className="print-dark">ચેક:</span><span className="print-dark">₹ {lastSavedData.chequeAmount}</span></div>}
                {lastSavedData.chequeNumber && <div style={{color: "#555", marginTop: "0.2rem"}} className="print-dark">ચેક નં: {lastSavedData.chequeNumber}</div>}
              </div>
            )}

            <div className="hide-on-print" style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
              <button type="button" onClick={() => {
                const waText = `*મગફળી ખરીદી બિલ*\n\nવાઉચર નં: ${lastSavedData.voucherId}\nખેડૂતનું નામ: ${lastSavedData.farmerName}\nવજન: ${lastSavedData.finalWeight} kg\nભાવ: ₹${lastSavedData.purchaseRate}\n------------------\n*કુલ રકમ: ₹${Number(lastSavedData.finalAmount).toLocaleString('en-IN')}*\n` 
                + (lastSavedData.cashAmount ? `રોકડ: ₹${lastSavedData.cashAmount}\n` : "") 
                + (lastSavedData.chequeAmount ? `ચેક: ₹${lastSavedData.chequeAmount}\n` : "")
                + (lastSavedData.chequeNumber ? `ચેક નં: ${lastSavedData.chequeNumber}\n` : "");
                
                const cleanPhone = lastSavedData.mobileNumber ? lastSavedData.mobileNumber.replace(/\\D/g, '') : '';
                const waUrl = cleanPhone && cleanPhone.length >= 10 
                  ? `https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(waText)}` 
                  : `https://wa.me/?text=${encodeURIComponent(waText)}`;
                
                window.open(waUrl, '_blank');
              }} className="btn" style={{ flex: 1, background: "#25D366", color: "white" }}><Share2 size={18} /> WhatsApp</button>
              <button type="button" onClick={() => window.print()} className="btn btn-primary" style={{ flex: 1 }}><Printer size={18} /> પ્રિન્ટ</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        @media print {
          body * { visibility: hidden; }
          .print-panel, .print-panel * { visibility: visible; }
          .print-panel { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; background: white !important; padding: 0 !important; }
          .print-dark { color: black !important; }
          .hide-on-print { display: none !important; }
        }
      `}</style>
    </main>
  );
}
