import React, { useEffect, useState } from 'react';

const fetchOrders = async () => {
  const res = await fetch("https://qsr-orders-default-rtdb.firebaseio.com/orders.json"); // Replace with your actual Firebase endpoint
  const data = await res.json();
  return Object.entries(data || {}).map(([id, order]) => ({ id, ...order }));
};

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const loadOrders = async () => {
      const data = await fetchOrders();
      setOrders(data.reverse());
    };

    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Pick Up Orders</h1>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {orders.map((order) => (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
            <h2>Order #{order["Order ID"]}</h2>
            <p><strong>Customer:</strong> {order["Customer Name"]}</p>
            <p><strong>Pickup Time:</strong> {order["Pickup Time"]}</p>
            <p><strong>Total:</strong> {order["Total Price"]}</p>
            <ul>
              {order["Order Items"].split(',').map((item, index) => (
                <li key={index}>{item.trim()}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
