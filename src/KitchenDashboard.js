// kitchen-dashboard: Adds orders + messages sections, sounds, timestamps, message filters.

import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [readMessages, setReadMessages] = useState(new Set(JSON.parse(localStorage.getItem('readMessages') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set());
  const [seenMessages, setSeenMessages] = useState(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);
  const msgAudio = useRef(null);

  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
    msgAudio.current = new Audio('/message.mp3');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!audioEnabled) return;

    const fetchData = async () => {
      const res = await fetch('https://qsr-orders-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();

      const ordersArray = [];
      const messagesArray = [];

      Object.entries(data || {}).forEach(([id, item]) => {
        const entry = { id, ...item };
        if (!entry["Order ID"] && !entry["Order Items"]) {
          messagesArray.push(entry);
        } else {
          ordersArray.push(entry);
        }
      });

      ordersArray.sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));
      messagesArray.sort((a, b) => new Date(b['Message Date']) - new Date(a['Message Date']));

      setOrders(ordersArray);
      setMessages(messagesArray);

      const newUnseenOrder = ordersArray.find(order => !seenOrders.has(order.id) && !accepted.has(order.id));
      if (newUnseenOrder) {
        setSeenOrders(prev => new Set(prev).add(newUnseenOrder.id));
        triggerAlarm(newUnseenOrder.id);
      }

      const newUnseenMsg = messagesArray.find(msg => !seenMessages.has(msg.id));
      if (newUnseenMsg) {
        setSeenMessages(prev => new Set(prev).add(newUnseenMsg.id));
        msgAudio.current.play();
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [audioEnabled, accepted, seenOrders, seenMessages]);

  const triggerAlarm = (orderId) => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(() => {
      if (!accepted.has(orderId)) alarmAudio.current.play();
      else clearInterval(alarmIntervalRef.current);
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
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "Accepted At": timestamp })
    });
    clearInterval(alarmIntervalRef.current);
  };

  const markMessageRead = (id) => {
    setReadMessages(prev => {
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

  const displayedOrders = orders.filter(order => {
    const isAccepted = accepted.has(order.id);
    const isInDateRange = isTodayOrYesterday(order['Order Date']);
    return showAccepted ? isAccepted && isInDateRange : !isAccepted;
  });

  const displayedMessages = messages.filter(msg => isTodayOrYesterday(msg['Message Date']));

  const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dailyOrderCount = orders.filter(order => new Date(order['Order Date']).toDateString() === today.toDateString()).length;

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
        {displayedOrders.map(order => (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
            <h2>Order #{order["Order ID"]}</h2>
            <p><strong>Customer:</strong> {order["Customer Name"]}</p>
            <p><strong>Order Type:</strong> {order["Order Type"] || 'N/A'}</p>
            {order["Order Type"]?.toLowerCase() === 'delivery' && (
              <p><strong>Delivery Address:</strong> {order["Delivery Address"] || 'N/A'}</p>
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
            <ul>{order["Order Items"].split(',').map((item, i) => <li key={i}>{item.trim()}</li>)}</ul>
            {!accepted.has(order.id) && (
              <button onClick={() => acceptOrder(order.id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
                ACCEPT
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: '3rem' }}>Incoming Messages</h2>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {displayedMessages.map(msg => (
          <div key={msg.id} style={{ border: '1px solid #aaa', padding: '1rem', borderRadius: '8px', backgroundColor: '#f8f8f8' }}>
            <p><strong>Date:</strong> {msg["Message Date"] || 'N/A'}</p>
            <p><strong>Name:</strong> {msg["Customer Name"] || 'N/A'}</p>
            <p><strong>Phone:</strong> {msg["Customer Contact Number"] || 'N/A'}</p>
            <p><strong>Reason:</strong> {msg["Reason"] || 'N/A'}</p>
            {!readMessages.has(msg.id) ? (
              <button onClick={() => markMessageRead(msg.id)} style={{ backgroundColor: 'red', color: 'white', border: 'none', padding: '0.4rem 0.8rem', marginTop: '0.5rem' }}>READ MESSAGE</button>
            ) : (
              <button style={{ backgroundColor: 'green', color: 'white', border: 'none', padding: '0.4rem 0.8rem', marginTop: '0.5rem' }}>READ</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
