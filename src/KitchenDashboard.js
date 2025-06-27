// kitchen-dashboard: Now supports incoming messages with separate sound alerts and message read status toggle

import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set());
  const [seenMessages, setSeenMessages] = useState(new Set(JSON.parse(localStorage.getItem('readMessages') || '[]')));
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);
  const messageAudio = useRef(null);

  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
    messageAudio.current = new Audio('/message.mp3');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!audioEnabled) return;

    const fetchOrders = async () => {
      const res = await fetch('https://qsr-orders-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();

      const orderArray = Object.entries(data || {}).map(([id, order]) => ({
        id,
        ...order,
      }));

      orderArray.sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));
      setOrders(orderArray);

      // Detect new unaccepted orders
      const newUnseen = orderArray.find(order => !seenOrders.has(order.id) && !accepted.has(order.id) && order["Order Items"]);
      if (newUnseen) {
        setSeenOrders(prev => new Set(prev).add(newUnseen.id));
        triggerAlarm(newUnseen.id);
      }

      // Detect new messages (no order ID and has reason for call)
      const newMessage = orderArray.find(order => !seenMessages.has(order.id) && !order['Order ID'] && order['Reason for the call']);
      if (newMessage) {
        setSeenMessages(prev => {
          const updated = new Set(prev).add(newMessage.id);
          localStorage.setItem('readMessages', JSON.stringify(Array.from(updated)));
          return updated;
        });
        messageAudio.current.play();
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [audioEnabled, accepted, seenOrders, seenMessages]);

  const triggerAlarm = (orderId) => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(() => {
      if (!accepted.has(orderId)) {
        alarmAudio.current.play();
      } else {
        clearInterval(alarmIntervalRef.current);
      }
    }, 30000);
    alarmAudio.current.play();
  };

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

    clearInterval(alarmIntervalRef.current);
  };

  const markMessageRead = (id) => {
    setSeenMessages(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('readMessages', JSON.stringify(Array.from(updated)));
      return updated;
    });
  };

  if (!audioEnabled) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Pick Up Orders</h1>
        <p>Please click the button below to start the dashboard and enable sound alerts.</p>
        <button onClick={() => setAudioEnabled(true)} style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>
          Start Dashboard
        </button>
      </div>
    );
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isTodayOrYesterday = (dateStr) => {
    const date = new Date(dateStr);
    return (
      date.toDateString() === today.toDateString() ||
      date.toDateString() === yesterday.toDateString()
    );
  };

  const displayedOrders = orders
    .filter(order => {
      const isAccepted = accepted.has(order.id);
      const isInDateRange = isTodayOrYesterday(order['Order Date']);
      return order['Order Items'] && (showAccepted ? isAccepted && isInDateRange : !isAccepted);
    })
    .sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));

  const messages = orders
    .filter(order => !order['Order ID'] && order['Reason for the call'] && isTodayOrYesterday(order['Message Date']))
    .sort((a, b) => new Date(b['Message Date']) - new Date(a['Message Date']));

  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const dailyOrderCount = orders.filter(order => {
    const orderDate = new Date(order['Order Date']);
    return order['Order Items'] && orderDate.toDateString() === today.toDateString();
  }).length;

  const getElapsedTime = (dateStr) => {
    const elapsed = now - new Date(dateStr);
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s ago`;
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Pick Up Orders</h1>
      <p><strong>Date:</strong> {formattedDate}</p>
      <p><strong>Orders Today:</strong> {dailyOrderCount}</p>

      <button onClick={() => setShowAccepted(prev => !prev)} style={{ marginBottom: '1rem', padding: '1rem 2rem', fontSize: '1.1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px' }}>
        {showAccepted ? 'Hide Accepted Orders' : 'View Accepted Orders'}
      </button>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {displayedOrders.map((order) => (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
            <h2>Order #{order["Order ID"]}</h2>
            <p><strong>Customer:</strong> {order["Customer Name"]}</p>
            <p><strong>Order Type:</strong> {order["Order Type"] || order.Order_Type || 'N/A'}</p>
            {(order["Order Type"] || order.Order_Type)?.toLowerCase() === 'delivery' && (
              <p><strong>Delivery Address:</strong> {order["Delivery Address"] || order.Delivery_Address || 'N/A'}</p>
            )}
            <p><strong>Order Date:</strong> {order["Order Date"]}</p>
            {showAccepted && order["Accepted At"] && (
              <p style={{ color: 'green', fontWeight: 'bold' }}><strong>Accepted At:</strong> {new Date(order["Accepted At"]).toLocaleString()}</p>
            )}
            {!showAccepted && order["Order Date"] && (
              <p><strong>Elapsed Time:</strong> <span style={{ color: 'goldenrod' }}>{getElapsedTime(order["Order Date"])}</span></p>
            )}
            <p style={{ color: 'red', fontWeight: 'bold' }}><strong>Pickup Time:</strong> {order["Pickup Time"]}</p>
            <p><strong>Total:</strong> {order["Total Price"]}</p>
            <ul>
              {order["Order Items"].split(',').map((item, index) => (
                <li key={index}>{item.trim()}</li>
              ))}
            </ul>
            {!accepted.has(order.id) && (
              <button onClick={() => acceptOrder(order.id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
                ACCEPT
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: '2rem' }}>Incoming Messages</h2>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ border: '1px solid #888', padding: '1rem', borderRadius: '8px', backgroundColor: '#fefefe' }}>
            <p><strong>Date:</strong> {msg["Message Date"] || msg["Order Date"]}</p>
            <p><strong>Name:</strong> {msg["Customer Name"] || msg["Callers Name"]}</p>
            <p><strong>Phone:</strong> {msg["Contact Phone Number"] || msg["Customer Contact Number"]}</p>
            <p><strong>Reason:</strong> {msg["Reason for the call"]}</p>
            {!seenMessages.has(msg.id) ? (
              <button onClick={() => markMessageRead(msg.id)} style={{ marginTop: '0.5rem', backgroundColor: '#dc3545', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px' }}>
                READ MESSAGE
              </button>
            ) : (
              <span style={{ color: 'green', fontWeight: 'bold' }}>READ</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
