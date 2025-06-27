// kitchen-dashboard: Handles orders and incoming messages, includes elapsed timer, alerts, accepted timestamp, filters, and now incoming message support.

import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set());
  const [seenMessages, setSeenMessages] = useState(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const alarmIntervalRef = useRef(null);
  const orderAlarmAudio = useRef(null);
  const messageAlarmAudio = useRef(null);

  useEffect(() => {
    orderAlarmAudio.current = new Audio('/alert.mp3');
    messageAlarmAudio.current = new Audio('/message-alert.mp3');
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

      const orderArray = Object.entries(data || {}).map(([id, order]) => ({ id, ...order }));
      orderArray.sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));
      setOrders(orderArray);

      const newUnseenOrder = orderArray.find(order => !seenOrders.has(order.id) && !accepted.has(order.id) && (order['Order Type'] || '').toLowerCase() !== 'message');
      if (newUnseenOrder) {
        setSeenOrders(prev => new Set(prev).add(newUnseenOrder.id));
        triggerOrderAlarm(newUnseenOrder.id);
      }

      const newUnseenMessage = orderArray.find(order => !seenMessages.has(order.id) && (order['Order Type'] || '').toLowerCase() === 'message');
      if (newUnseenMessage) {
        setSeenMessages(prev => new Set(prev).add(newUnseenMessage.id));
        messageAlarmAudio.current.play();
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [audioEnabled, accepted, seenOrders, seenMessages]);

  const triggerOrderAlarm = (orderId) => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(() => {
      if (!accepted.has(orderId)) {
        orderAlarmAudio.current.play();
      } else {
        clearInterval(alarmIntervalRef.current);
      }
    }, 30000);
    orderAlarmAudio.current.play();
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

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isTodayOrYesterday = (dateStr) => {
    const date = new Date(dateStr);
    return date.toDateString() === today.toDateString() || date.toDateString() === yesterday.toDateString();
  };

  const displayedOrders = orders.filter(order => {
    const isAccepted = accepted.has(order.id);
    const isInDateRange = isTodayOrYesterday(order['Order Date']);
    return showAccepted ? isAccepted && isInDateRange : !isAccepted;
  }).sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));

  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const dailyOrderCount = orders.filter(order => {
    const orderDate = new Date(order['Order Date']);
    return orderDate.toDateString() === today.toDateString();
  }).length;

  const getElapsedTime = (dateStr) => {
    const elapsed = now - new Date(dateStr);
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s ago`;
  };

  const renderOrderCard = (order) => {
    const isMessage = (order['Order Type'] || '').toLowerCase() === 'message';
    if (isMessage) {
      return (
        <div key={order.id} style={{ border: '1px solid #888', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#fff7e6', fontSize: '1.1rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>📩 Incoming Message</h2>
          <p><strong>From:</strong> {order['Callers Name'] || 'Unknown'}</p>
          <p><strong>Phone:</strong> {order['Call Back Number'] || 'Unknown'}</p>
          <p><strong>Received:</strong> {order['Message Date'] || order['Order Date']}</p>
          <p><strong>Reason:</strong> {order['Reason For The Call'] || 'Not provided'}</p>
          <button style={{ marginTop: '0.5rem', backgroundColor: 'red', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
            READ MESSAGE
          </button>
        </div>
      );
    }

    return (
      <div key={order.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
        <h2>Order #{order['Order ID']}</h2>
        <p><strong>Customer:</strong> {order['Customer Name']}</p>
        <p><strong>Order Type:</strong> {order['Order Type'] || 'N/A'}</p>
        {(order['Order Type'] || '').toLowerCase() === 'delivery' && (
          <p><strong>Delivery Address:</strong> {order['Delivery Address'] || 'N/A'}</p>
        )}
        <p><strong>Order Date:</strong> {order['Order Date']}</p>
        {showAccepted && order['Accepted At'] && (
          <p style={{ color: 'green', fontWeight: 'bold' }}><strong>Accepted At:</strong> {new Date(order['Accepted At']).toLocaleString()}</p>
        )}
        {!showAccepted && order['Order Date'] && (
          <p><strong>Elapsed Time:</strong> <span style={{ color: 'goldenrod' }}>{getElapsedTime(order['Order Date'])}</span></p>
        )}
        <p style={{ color: 'red', fontWeight: 'bold' }}><strong>Pickup Time:</strong> {order['Pickup Time']}</p>
        <p><strong>Total:</strong> {order['Total Price']}</p>
        <ul>
          {(order['Order Items'] || '').split(',').map((item, index) => (
            <li key={index}>{item.trim()}</li>
          ))}
        </ul>
        {!accepted.has(order.id) && (
          <button onClick={() => acceptOrder(order.id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
            ACCEPT
          </button>
        )}
      </div>
    );
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

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Pick Up Orders</h1>
      <p style={{ margin: '0.5rem 0' }}><strong>Date:</strong> {formattedDate}</p>
      <p style={{ margin: '0.5rem 0' }}><strong>Orders Today:</strong> {dailyOrderCount}</p>
      <button
        onClick={() => setShowAccepted(prev => !prev)}
        style={{
          marginBottom: '1rem',
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '8px'
        }}>
        {showAccepted ? 'Hide Accepted Orders' : 'View Accepted Orders'}
      </button>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {displayedOrders.map(renderOrderCard)}
      </div>
    </div>
  );
}
