import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);

  // Load alert.mp3
  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
  }, []);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Alarm loop that plays sound every 10s until all orders are accepted
  const triggerGlobalAlarm = () => {
    if (alarmIntervalRef.current) return; // already running
    alarmIntervalRef.current = setInterval(() => {
      const hasUnacceptedOrders = orders.some(order =>
        (order['Order Type'] === 'PICK UP' || order['Order Type'] === 'DELIVERY') &&
        !accepted.has(order.id)
      );
      if (hasUnacceptedOrders) {
        console.log("🔔 Playing alert.mp3 — unaccepted order exists");
        alarmAudio.current.play().catch(err => {
          console.warn("⚠️ Audio play failed:", err);
        });
      } else {
        console.log("✅ All orders accepted — stopping alarm");
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    }, 10000);
  };

  // Fetch orders and always check for alarm trigger
  useEffect(() => {
    if (!audioEnabled) return;

    const fetchOrders = async () => {
      const res = await fetch('https://qsr-orders-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();
      const orderArray = Object.entries(data || {}).map(([id, order]) => ({ id, ...order }));

      orderArray.sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));
      setOrders(orderArray);

      // Mark unseen orders
      const newUnseenOrder = orderArray.find(order =>
        !seenOrders.has(order.id) &&
        !accepted.has(order.id) &&
        order['Order Items']
      );
      if (newUnseenOrder) {
        setSeenOrders(prev => new Set(prev).add(newUnseenOrder.id));
      }

      // 🔥 Always check if alarm should run or stop
      const hasUnaccepted = orderArray.some(order =>
        (order['Order Type'] === 'PICK UP' || order['Order Type'] === 'DELIVERY') &&
        !accepted.has(order.id)
      );
      if (hasUnaccepted) {
        triggerGlobalAlarm();
      } else if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [audioEnabled, accepted, seenOrders]);

  // Accept order
  const acceptOrder = async (id) => {
    const timestamp = new Date().toISOString();
    setAccepted(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('acceptedOrders', JSON.stringify(Array.from(updated)));
      return updated;
    });
    await fetch(`https://qsr-orders-default-rtdb.firebaseio.com/orders/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "Accepted At": timestamp })
    });
  };

  // Before dashboard is started
  if (!audioEnabled) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Orders and Messages Dashboard</h1>
        <p>Please click the button below to start the dashboard and enable sound alerts.</p>
        <p>(c) 2025 RT7 USA Incorporated. All rights reserved.</p>
        <button
          onClick={() => {
            setAudioEnabled(true);
            if (alarmAudio.current) {
              alarmAudio.current
                .play()
                .then(() => {
                  console.log("✅ Audio playback allowed and working");
                  alarmAudio.current.pause();
                  alarmAudio.current.currentTime = 0;
                })
                .catch(err => {
                  console.warn("⚠️ Audio playback failed (maybe autoplay blocked):", err);
                });
            }
          }}
          style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}
        >
          Start Dashboard
        </button>
      </div>
    );
  }

  // Date helpers
  const today = new Date();
  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };
  const todayStr = formatDate(today);

  // Count of today's orders
  const dailyOrderCount = orders.filter(order =>
    formatDate(new Date(order['Order Date'])) === todayStr
  ).length;

  const getElapsedTime = (dateStr) => {
    const orderDate = new Date(dateStr);
    if (isNaN(orderDate)) return "Invalid date";
    const elapsed = now - orderDate;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s ago`;
  };

  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const displayedOrders = orders.filter(order => {
    const isAcceptedOrder = accepted.has(order.id);
    const isInDateRange = formatDate(new Date(order['Order Date'])) === todayStr;
    return showAccepted ? isAcceptedOrder && isInDateRange : !isAcceptedOrder && isInDateRange;
  }).sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Orders and Messages - California Sandwiches Winston Churchill</h1>
      <p><strong>Date:</strong> {formattedDate}</p>
      <p><strong>Orders Today:</strong> {dailyOrderCount}</p>

      <button
        onClick={() => setShowAccepted(prev => !prev)}
        style={{ marginRight: '1rem', backgroundColor: 'red', color: 'white', padding: '0.5rem 1rem' }}
      >
        {showAccepted ? 'Hide Accepted Orders' : 'View Accepted Orders'}
      </button>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
        {displayedOrders.map(order => (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
            <h2>Order #{order['Order ID']}</h2>
            <p><strong>Customer:</strong> {order['Customer Name']}</p>
            <p><strong>Order Type:</strong> {order['Order Type'] || 'N/A'}</p>
            {order['Order Type']?.toLowerCase() === 'delivery' && (
              <p><strong>Delivery Address:</strong> {order['Delivery Address']}</p>
            )}
            <p><strong>Order Date:</strong> {order['Order Date']}</p>
            {showAccepted && order['Accepted At'] && (
              <p style={{ color: 'green', fontWeight: 'bold' }}>
                <strong>Accepted At:</strong> {new Date(order['Accepted At']).toLocaleString()}
              </p>
            )}
            {!showAccepted && order['Order Date'] && (
              <p><strong>Elapsed Time:</strong> <span style={{ color: 'goldenrod' }}>{getElapsedTime(order['Order Date'])}</span></p>
            )}
            <p style={{ color: 'red', fontWeight: 'bold' }}><strong>Pickup Time:</strong> {order['Pickup Time']}</p>
            <p><strong>Total:</strong> {order['Total Price']}</p>
            <ul>
              {order['Order Items'].split(',').map((item, index) => (
                <li key={index}>{item.trim()}</li>
              ))}
            </ul>
            {!accepted.has(order.id) && (
              <button
                onClick={() => acceptOrder(order.id)}
                style={{
                  marginTop: '1rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                ACCEPT
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
