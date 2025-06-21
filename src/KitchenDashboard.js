// kitchen-dashboard: Persist accepted orders in localStorage to hide them on reload

import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);

  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
  }, []);

  useEffect(() => {
    if (!audioEnabled) return;

    const fetchOrders = async () => {
      const res = await fetch('https://qsr-orders-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();

      const orderArray = Object.entries(data || {}).map(([id, order]) => ({
        id,
        ...order,
      })).filter(order => !accepted.has(order.id));

      orderArray.sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));

      setOrders(orderArray);

      const newUnseen = orderArray.find(order => !seenOrders.has(order.id));
      if (newUnseen) {
        setSeenOrders(prev => new Set(prev).add(newUnseen.id));
        triggerAlarm(newUnseen.id);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [audioEnabled, accepted, seenOrders]);

  const triggerAlarm = (orderId) => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
    }
    alarmIntervalRef.current = setInterval(() => {
      if (!accepted.has(orderId)) {
        alarmAudio.current.play();
      } else {
        clearInterval(alarmIntervalRef.current);
      }
    }, 30000);
    alarmAudio.current.play();
  };

  const acceptOrder = (id) => {
    setAccepted(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('acceptedOrders', JSON.stringify(Array.from(updated)));
      return updated;
    });
    clearInterval(alarmIntervalRef.current);
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
      <div style={{ display: 'grid', gap: '1rem' }}>
        {orders.map((order) => (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
            <h2>Order #{order["Order ID"]}</h2>
            <p><strong>Customer:</strong> {order["Customer Name"]}</p>
            <p><strong>Order Date:</strong> {order["Order Date"] || order.Order_Date || order.OrderDate || 'Not provided'}</p>
            <p><strong>Pickup Time:</strong> {order["Pickup Time"]}</p>
            <p><strong>Total:</strong> {order["Total Price"]}</p>
            <ul>
              {order["Order Items"].split(',').map((item, index) => (
                <li key={index}>{item.trim()}</li>
              ))}
            </ul>
            <button onClick={() => acceptOrder(order.id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
              ACCEPT
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
