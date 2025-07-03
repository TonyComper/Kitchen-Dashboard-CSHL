import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set());
  const [seenMessages, setSeenMessages] = useState(new Set(JSON.parse(localStorage.getItem('seenMessages') || '[]')));
  const [readMessages, setReadMessages] = useState(new Set(JSON.parse(localStorage.getItem('readMessages') || '[]')));
  const [showReadMessages, setShowReadMessages] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);
  const messageAudio = useRef(null);

  function parseDate(input) {
    if (!input || typeof input !== 'string') return null;
    try {
      const cleaned = input.replace(/\(.*?\)/g, '').trim();
      const parsed = new Date(cleaned);
      return isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
    alarmAudio.current.load();

    messageAudio.current = new Audio('/message-alert.mp3');
    messageAudio.current.load();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerGlobalAlarm = () => {
    if (alarmIntervalRef.current) return;
    alarmIntervalRef.current = setInterval(() => {
      const hasUnacceptedOrders = orders.some(order =>
        (order['Order Type'] === 'PICK UP' || order['Order Type'] === 'DELIVERY') &&
        !accepted.has(order.id)
      );
      if (hasUnacceptedOrders) {
        alarmAudio.current.play().catch(() => {});
      } else {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    }, 10000);
  };

  useEffect(() => {
    if (!audioEnabled) return;

    const fetchOrders = async () => {
      const res = await fetch('https://qsr-orders-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();

      const orderArray = Object.entries(data || {}).map(([id, order]) => ({ id, ...order }));

      orderArray.sort((a, b) => {
        const dateA = parseDate(a['Order Date'] || a['Message Date']);
        const dateB = parseDate(b['Order Date'] || b['Message Date']);
        return (dateB || 0) - (dateA || 0);
      });

      setOrders(orderArray);

      const newUnseenOrder = orderArray.find(order =>
        !seenOrders.has(order.id) &&
        !accepted.has(order.id) &&
        order['Order Type'] !== 'MESSAGE' &&
        order['Order Items']
      );
      if (newUnseenOrder) {
        setSeenOrders(prev => new Set(prev).add(newUnseenOrder.id));
      }

      const newUnseenMessage = orderArray.find(order =>
        order['Order Type'] === 'MESSAGE' &&
        !seenMessages.has(order.id)
      );
      if (newUnseenMessage) {
        setSeenMessages(prev => {
          const updated = new Set(prev).add(newUnseenMessage.id);
          localStorage.setItem('seenMessages', JSON.stringify([...updated]));
          return updated;
        });
        if (messageAudio.current) {
          messageAudio.current.currentTime = 0;
          messageAudio.current.play().catch(() => {});
        }
      }

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
  }, [audioEnabled, accepted, seenOrders, seenMessages]);

  const acceptOrder = async (id) => {
    const timestamp = new Date().toISOString();
    setAccepted(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('acceptedOrders', JSON.stringify([...updated]));
      return updated;
    });
    await fetch(`https://qsr-orders-default-rtdb.firebaseio.com/orders/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "Accepted At": timestamp })
    });
  };

  const markMessageAsRead = (id) => {
    setReadMessages(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('readMessages', JSON.stringify([...updated]));
      return updated;
    });
  };

  if (!audioEnabled) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Orders and Messages Dashboard</h1>
        <p>Click below to start and enable alerts.</p>
        <button onClick={() => setAudioEnabled(true)} style={{ padding: '1rem', fontSize: '1rem' }}>Start Dashboard</button>
      </div>
    );
  }

  const formatDate = (date) => {
    const d = parseDate(date);
    return !d ? '' : `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const today = formatDate(new Date());

  const filteredOrders = orders.filter(order =>
    formatDate(order['Order Date']) === today &&
    (showAccepted ? accepted.has(order.id) : !accepted.has(order.id)) &&
    order['Order Type'] !== 'MESSAGE'
  );

  const filteredMessages = orders.filter(order =>
    order['Order Type'] === 'MESSAGE' &&
    formatDate(order['Message Date']) === today &&
    (showReadMessages ? readMessages.has(order.id) : !readMessages.has(order.id))
  );

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Orders and Messages - California Sandwiches Winston Churchill</h1>
      <div>
        <button onClick={() => setShowAccepted(s => !s)}>{showAccepted ? 'Hide Accepted' : 'View Accepted'}</button>
        <button onClick={() => setShowReadMessages(s => !s)}>{showReadMessages ? 'Hide Read Messages' : 'View Read Messages'}</button>
      </div>

      {filteredMessages.map(msg => (
        <div key={msg.id} style={{ background: '#ffeaea', margin: '1rem 0', padding: '1rem', borderRadius: '8px' }}>
          <h3>📨 {showReadMessages ? 'Read Message' : 'New Message'}</h3>
          <p><strong>Time:</strong> {msg['Message Date']}</p>
          <p><strong>Name:</strong> {msg['Caller_Name']}</p>
          <p><strong>Phone:</strong> {msg['Caller_Phone']}</p>
          <p><strong>Reason:</strong> {msg['Message_Reason']}</p>
          {!showReadMessages && (
            <button onClick={() => markMessageAsRead(msg.id)}>Mark As Read</button>
          )}
        </div>
      ))}

      {filteredOrders.map(order => (
        <div key={order.id} style={{ background: '#e6f9e6', padding: '1rem', margin: '1rem 0', borderRadius: '8px' }}>
          <h2>Order #{order['Order ID']}</h2>
          <p><strong>Customer:</strong> {order['Customer Name']}</p>
          <p><strong>Type:</strong> {order['Order Type']}</p>
          {order['Order Type'] === 'DELIVERY' && (
            <p><strong>Address:</strong> {order['Delivery Address']}</p>
          )}
          <p><strong>Pickup Time:</strong> {order['Pickup Time']}</p>
          <p><strong>Total:</strong> {order['Total Price']}</p>
          <ul>
            {(order['Order Items'] || '').split(',').map((item, idx) => <li key={idx}>{item.trim()}</li>)}
          </ul>
          {!accepted.has(order.id) && (
            <button onClick={() => acceptOrder(order.id)}>Accept</button>
          )}
        </div>
      ))}
    </div>
  );
}
