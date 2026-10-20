import React, { useState, useRef, useEffect } from 'react';

export default function MapEditor() {
  const [mapImage, setMapImage] = useState(null);
  const [tool, setTool] = useState('boundary'); // 'boundary' | 'foreground'
  const [strokes, setStrokes] = useState([]);
  const [drawingStroke, setDrawingStroke] = useState(null);
  const [selectedStrokeIndex, setSelectedStrokeIndex] = useState(null);
  
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  // Handle uploading the main PNG map
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        setMapImage(img);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  // Convert click mouse coordinates relative to the canvas
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top)
    };
  };

  const handleMouseDown = (e) => {
    if (!mapImage) return;
    isDrawing.current = true;
    const coords = getCanvasCoords(e);
    setDrawingStroke({ type: tool, points: [coords] });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;
    const coords = getCanvasCoords(e);
    setDrawingStroke((current) => (
      current ? { ...current, points: [...current.points, coords] } : current
    ));
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (drawingStroke && drawingStroke.points.length > 1) {
      setStrokes((prev) => [...prev, drawingStroke]);
    }
    setDrawingStroke(null);
  };

  // Redraw canvas whenever the map or drawn strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImage) return;

    const ctx = canvas.getContext('2d');
    canvas.width = mapImage.width;
    canvas.height = mapImage.height;

    // 1. Draw Map Image
    ctx.drawImage(mapImage, 0, 0);

    const drawStroke = (stroke, idx, active = false) => {
      if (stroke.points.length < 2) return;
      ctx.strokeStyle = stroke.type === 'boundary' ? '#ff0000' : '#0066ff';
      ctx.globalAlpha = active ? 0.8 : 0.65;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();

      if (idx === selectedStrokeIndex) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 11;
        ctx.stroke();
      }
    };

    strokes.forEach((stroke, idx) => drawStroke(stroke, idx));
    if (drawingStroke) drawStroke(drawingStroke, -1, true);
    ctx.globalAlpha = 1;
  }, [mapImage, strokes, drawingStroke, selectedStrokeIndex]);

  const removeSelectedStroke = () => {
    if (selectedStrokeIndex !== null) {
      setStrokes((prev) => prev.filter((_, idx) => idx !== selectedStrokeIndex));
      setSelectedStrokeIndex(null);
    }
  };

  const exportCode = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(strokes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "map-boundaries.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importCode = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (Array.isArray(imported)) {
            setStrokes(imported);
          }
        } catch (err) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', color: '#fff', minHeight: '100vh' }}>
      <h1>React Map Pen & Layer Editor</h1>
      
      {/* Control Panel */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ marginRight: '8px' }}>Load Map PNG:</label>
          <input type="file" accept="image/png" onChange={handleImageUpload} />
        </div>

        <div style={{ borderLeft: '1px solid #444', paddingLeft: '15px' }}>
          <button
            style={{ padding: '8px 12px', marginRight: '5px', backgroundColor: tool === 'boundary' ? '#ff0000' : '#444', color: '#fff', border: 'none', cursor: 'pointer' }}
            onClick={() => setTool('boundary')}
          >
            Red Pen: Boundary
          </button>
          <button
            style={{ padding: '8px 12px', backgroundColor: tool === 'foreground' ? '#0066ff' : '#444', color: '#fff', border: 'none', cursor: 'pointer' }}
            onClick={() => setTool('foreground')}
          >
            Blue Pen: Foreground
          </button>
        </div>

        <div style={{ borderLeft: '1px solid #444', paddingLeft: '15px' }}>
          <button onClick={exportCode} disabled={strokes.length === 0} style={{ padding: '8px 12px', marginRight: '5px', cursor: 'pointer' }}>
            Export JSON
          </button>
          <label style={{ padding: '8px 12px', backgroundColor: '#444', cursor: 'pointer' }}>
            Import JSON
            <input type="file" accept="application/json" onChange={importCode} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Editor Canvas Area */}
      {!mapImage ? (
        <div style={{ border: '2px dashed #666', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Upload a PNG Map image to begin drawing with either pen
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ overflow: 'auto', maxHeight: '80vh', border: '1px solid #444' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: 'crosshair', display: 'block' }}
            />
          </div>

          {/* Sidebar / Inspector */}
          <div style={{ width: '280px', backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '4px' }}>
            <h3>Stroke List ({strokes.length})</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '15px' }}>
              {strokes.map((stroke, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedStrokeIndex(idx)}
                  style={{
                    padding: '8px',
                    marginBottom: '5px',
                    backgroundColor: selectedStrokeIndex === idx ? '#444' : '#333',
                    borderLeft: `4px solid ${stroke.type === 'boundary' ? '#ff0000' : '#0066ff'}`,
                    cursor: 'pointer'
                  }}
                >
                  <strong>{stroke.type.toUpperCase()} #{idx + 1}</strong>
                  <br />
                  <small>{stroke.points.length} points</small>
                </div>
              ))}
            </div>

            {selectedStrokeIndex !== null && (
              <button onClick={removeSelectedStroke} style={{ width: '100%', padding: '8px', backgroundColor: '#d9534f', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Delete Selected Stroke
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}