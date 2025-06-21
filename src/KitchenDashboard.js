// kitchen-dashboard: Updated with repeating alarm until ACCEPT

import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set());
  const [lastOrderId, setLastOrderId] = useState(null);
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);

  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      const res = await fetch('https://qsr-orders-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();

      const orderArray = Object.entries(data || {}).map(([id, order]) => ({
        id,
        ...order,
      }));

      // Sort by Order Date if available
      orderArray.sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));

      if (orderArray.length > 0 && orderArray[0].id !== lastOrderId) {
        setLastOrderId(orderArray[0].id);
        triggerAlarm(orderArray[0].id);
      }

      setOrders(orderArray);
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [lastOrderId]);

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
    setAccepted(prev => new Set(prev).add(id));
    clearInterval(alarmIntervalRef.current);
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Pick Up Orders</h1>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {orders.filter(order => !accepted.has(order.id)).map((order) => (
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
