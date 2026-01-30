interface NodeExplorerControlProps {
  value: number;
  maxValue: number;
  onChange: (value: number) => void;
}

export const NodeExplorerControl = ({ value, maxValue, onChange }: NodeExplorerControlProps) => {
  const presets = [10, 20, 50, 100];

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.98)",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        minWidth: "240px",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "14px", color: "#374151" }}>
          Explorador de Nodos
        </span>
        <span
          style={{
            fontSize: "12px",
            color: value >= maxValue ? "#EF4444" : "#6B7280",
            fontWeight: 500,
          }}
        >
          {value}/{maxValue}
        </span>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <input
          type="range"
          min="5"
          max={maxValue}
          step="5"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: "100%",
            height: "6px",
            WebkitAppearance: "none",
            appearance: "none",
            background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(value / maxValue) * 100}%, #E5E7EB ${(value / maxValue) * 100}%, #E5E7EB 100%)`,
            borderRadius: "3px",
            outline: "none",
            cursor: "pointer",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#9CA3AF",
            marginTop: "6px",
          }}
        >
          <span>5</span>
          <span>{maxValue}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            style={{
              padding: "4px 10px",
              background: value === preset ? "#3B82F6" : "#F3F4F6",
              color: value === preset ? "white" : "#6B7280",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: value === preset ? 600 : 400,
              transition: "all 0.15s ease",
            }}
          >
            {preset}
          </button>
        ))}
        <button
          onClick={() => onChange(maxValue)}
          style={{
            padding: "4px 10px",
            background: value === maxValue ? "#EF4444" : "#F3F4F6",
            color: value === maxValue ? "white" : "#6B7280",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: value === maxValue ? 600 : 400,
            transition: "all 0.15s ease",
          }}
        >
          Todos
        </button>
      </div>

      <div
        style={{
          marginTop: "12px",
          padding: "8px 12px",
          background: "#FEF3C7",
          borderRadius: "6px",
          fontSize: "11px",
          color: "#92400E",
          lineHeight: 1.4,
        }}
      >
        💡 Reduce el número de nodos para mejorar la navegación y el rendimiento.
      </div>
    </div>
  );
};
