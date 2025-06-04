import React, { useState, useEffect, CSSProperties } from "react";
import "./RobotLoader.css";
import { useSpContext } from "../../SpContext";

const RobotLoader = () => {
  const { context } = useSpContext();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [processingData, setProcessingData] = useState({
    matched: 0,
    partial: 0,
    unmatched: 0,
    total: 10,
  });

  const steps = [
    {
      id: "loading",
      title: "Loading Excel Files",
      subtitle: "Importing and parsing data structures",
      icon: "📊",
      color: "blue",
      duration: 3500,
      details: [
        "Reading file headers",
        "Validating data types",
        "Building data maps",
      ],
    },
    {
      id: "analyzing",
      title: "Analyzing Data Patterns",
      subtitle: "AI-powered schema detection",
      icon: "🔍",
      color: "purple",
      duration: 4500,
      details: [
        "Detecting key columns",
        "Analyzing data quality",
        "Identifying relationships",
      ],
    },
    {
      id: "matching",
      title: "Intelligent Matching",
      subtitle: "Cross-referencing records with ML algorithms",
      icon: "🤖",
      color: "green",
      duration: 5500,
      details: [
        "Fuzzy string matching",
        "Probabilistic linking",
        "Confidence scoring",
      ],
    },
    {
      id: "validating",
      title: "Data Validation",
      subtitle: "Ensuring accuracy and integrity",
      icon: "🛡️",
      color: "orange",
      duration: 4000,
      details: [
        "Business rule validation",
        "Anomaly detection",
        "Quality assurance",
      ],
    },
    {
      id: "reporting",
      title: "Generating Report",
      subtitle: "Creating comprehensive reconciliation summary",
      icon: "📈",
      color: "indigo",
      duration: 3500,
      details: [
        "Statistical analysis",
        "Visual reporting",
        "Export preparation",
      ],
    },
    {
      id: "complete",
      title: "Report Generated Successfully",
      subtitle: "Comprehensive reconciliation analysis ready",
      icon: "✅",
      color: "teal",
      duration: 3000,
      details: [
        "✓ 50 records processed",
        "✓ 98.3% match accuracy",
        "✓ Report exported to Excel",
      ],
    },
  ];

  useEffect(() => {
    if (currentStep < steps.length - 1) {
      const stepInterval = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, steps[currentStep]?.duration || 2000);

      return () => clearTimeout(stepInterval);
    }
  }, [currentStep]);

  useEffect(() => {
    setProgress(0);

    if (currentStep < steps.length - 1) {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 100;
          const shouldPause = Math.random() < 0.15;
          if (shouldPause) return prev;
          return Math.min(prev + (Math.random() * 12 + 3), 100);
        });
      }, Math.random() * 200 + 100);

      return () => clearInterval(progressInterval);
    } else {
      const completeInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(completeInterval);
            return 100;
          }
          const shouldPause = Math.random() < 0.1;
          if (shouldPause) return prev;
          return Math.min(prev + 20, 100);
        });
      }, Math.random() * 150 + 75);

      return () => clearInterval(completeInterval);
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 2) {
      const dataInterval = setInterval(() => {
        setProcessingData((prev) => ({
          ...prev,
          matched: Math.min(
            prev.matched + Math.floor(Math.random() * 2 + 1),
            7
          ),
          partial: Math.min(
            prev.partial + Math.floor(Math.random() * 1 + 1),
            3
          ),
          unmatched: 0,
        }));
      }, 300);

      return () => clearInterval(dataInterval);
    }
  }, [currentStep]);

  const currentStepData = steps[currentStep];
  const isComplete = currentStep === steps.length - 1;

  return (
    <div className="excel-reconciliation-loader">
      {/* Animated background particles */}
      <div className="particles-container">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={
              {
                "--delay": `${Math.random() * 3}s`,
                "--duration": `${3 + Math.random() * 2}s`,
                "--size": `${2 + Math.random() * 3}px`,
                "--opacity": `${0.1 + Math.random() * 0.1}`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="loader-container">
        {/* Robot Avatar */}
        <div className="avatar-container">
          <div
            className={`avatar ${isComplete ? "complete" : ""} ${
              currentStepData?.color
            }`}
          >
            <div className="avatar-icon">{currentStepData?.icon}</div>

            {/* Processing indicator */}
            <div className="processing-indicator">
              <div className="indicator-dot">⚡</div>
            </div>

            {/* Glow effect */}
            <div className="avatar-glow" />
          </div>
        </div>

        {/* Main Content */}
        <div className="content-container">
          {/* Header */}
          <div className="header">
            <h1 className="title">{currentStepData?.title}</h1>
            <p className="subtitle">{currentStepData?.subtitle}</p>
          </div>

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-labels">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}>
                {!isComplete && <div className="progress-shimmer" />}
              </div>
            </div>
          </div>

          {/* Step Details */}
          <div className="details-container">
            {/* <div className="tasks-section">
              <h3>Current Tasks:</h3>
              {currentStepData?.details.map((detail, idx) => (
                <div key={idx} className="task-item">
                  <div className="task-dot" />
                  <span>{detail}</span>
                </div>
              ))}
            </div> */}

            {/* Live Stats */}
            {!isComplete ? (
              <div className="stats-section">
                <h3>Live Statistics:</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value matched">
                      {processingData.matched.toLocaleString()}
                    </div>
                    <div className="stat-label">Exact Match</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value matched">
                      {processingData.partial.toLocaleString()}
                    </div>
                    <div className="stat-label">Partial Match</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value unmatched">
                      {processingData.unmatched.toLocaleString()}
                    </div>
                    <div className="stat-label">Not Found</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {processingData.total.toLocaleString()}
                    </div>
                    <div className="stat-label">Total Records</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="summary-section">
                <h3>Final Report Summary:</h3>
                <div className="summary-card">
                  <div className="summary-grid">
                    <div>
                      <div className="summary-value matched">70%</div>
                      <div className="summary-label">Exact Match</div>
                    </div>
                    <div>
                      <div className="summary-value matched">30%</div>
                      <div className="summary-label">
                        Partial Match (98.3% accuracy)
                      </div>
                    </div>
                    <div>
                      <div className="summary-value unmatched">0%</div>
                      <div className="summary-label">Not Found</div>
                    </div>
                    <div>
                      <div className="summary-value">10</div>
                      <div className="summary-label">Total Records</div>
                    </div>
                  </div>
                  <div className="download-button-container">
                    <button
                      className="download-button"
                      onClick={() => {
                        window.open(
                          `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=SWAN`,
                          "_blank"
                        );
                      }}
                    >
                      Download Report
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step Indicator */}
          <div className="step-indicator">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`step-dot ${
                  idx === currentStep
                    ? "active"
                    : idx < currentStep
                    ? "completed"
                    : "pending"
                }`}
              />
            ))}
          </div>

          {/* Status Message
          <div className="status-message">
            <div
              className={`status-badge ${
                isComplete ? "complete" : "processing"
              }`}
            >
              <div className="status-dot" />
              <span>
                {isComplete ? "Reconciliation report ready for download!" : ""}
              </span>
            </div>
          </div> */}
        </div>

        {/* Footer
        <div className="footer">
          <p>Powered by FRCI Ltd • Advanced Excel Reconciliation Engine</p>
        </div> */}
      </div>
    </div>
  );
};

export default RobotLoader;
