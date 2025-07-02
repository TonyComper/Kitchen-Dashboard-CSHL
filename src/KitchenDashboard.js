import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set());
  const [seenMessages, setSeenMessages] = useState(new Set(JSON.parse(localStorage.getItem('seenMessages') || '[]')));
  const [readMessages, setReadMessages] = useState(new Set(JSON.parse(localStorage.getItem('readMessages') || '[]')));
  const [showReadMessages, setShowReadMessages] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);
  const messageAudio = useRef(null);

  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
    alarmAudio.current.load();

    messageAudio.current = new Audio('/message-alert.mp3');
    messageAudio.current.load();

    messageAudio.current.onplay = () => console.log("🔊 message-alert.mp3 is playing");
    messageAudio.current.onerror = (e) => console.warn("❌ message-alert.mp3 failed to play", e);
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
        alarmAudio.current.play().catch(err => console.warn("Alarm play failed:", err));
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

      const orderArray = Object.entries(data || {}).map(([id, order]) => ({
        id,
        ...order
      }));

      orderArray.sort((a, b) =>
        new Date(b['Order Date'] || b['Message Date']) - new Date(a['Order Date'] || a['Message Date'])
      );

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
        console.log("📨 Triggering message alert sound");
        setSeenMessages(prev => {
          const updated = new Set(prev).add(newUnseenMessage.id);
          localStorage.setItem('seenMessages', JSON.stringify(Array.from(updated)));
          return updated;
        });
        if (messageAudio.current) {
          messageAudio.current.currentTime = 0;
          messageAudio.current.play()
            .then(() => console.log("✅ message-alert.mp3 playback started"))
            .catch(err => console.warn("❌ message-alert.mp3 playback failed", err));
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
      localStorage.setItem('acceptedOrders', JSON.stringify(Array.from(updated)));
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
      localStorage.setItem('readMessages', JSON.stringify(Array.from(updated)));
      return updated;
    });
  };

  const today = new Date();
  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };
  const todayStr = formatDate(today);

  const isOlderThanDays = (dateStr, days) => {
    const date = new Date(dateStr);
    return !isNaN(date) && (now - date.getTime()) > (days * 86400000);
  };

  const displayedOrders = orders.filter(order => {
    const isAcceptedOrder = accepted.has(order.id);
    const isInDateRange = formatDate(new Date(order['Order Date'])) === todayStr;
    return !showArchived
      ? (showAccepted ? isAcceptedOrder && isInDateRange : !isAcceptedOrder && isInDateRange) && order['Order Type'] !== 'MESSAGE'
      : false;
  });

  const displayedMessages = orders.filter(order =>
    order['Order Type'] === 'MESSAGE' &&
    formatDate(new Date(order['Message Date'])) === todayStr &&
    !readMessages.has(order.id) &&
    !showArchived
  );

  const archivedItems = orders.filter(order => {
    const isOldAccepted = accepted.has(order.id) && isOlderThanDays(order['Accepted At'], 3);
    const isOldReadMessage = order['Order Type'] === 'MESSAGE' && readMessages.has(order.id) && isOlderThanDays(order['Message Date'], 3);
    return isOldAccepted || isOldReadMessage;
  }).sort((a, b) => new Date(b['Accepted At'] || b['Message Date']) - new Date(a['Accepted At'] || a['Message Date']));

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
              alarmAudio.current.play().then(() => {
                alarmAudio.current.pause();
                alarmAudio.current.currentTime = 0;
              }).catch(() => {});
            }
            if (messageAudio.current) {
              messageAudio.current.play().then(() => {
                messageAudio.current.pause();
                messageAudio.current.currentTime = 0;
              }).catch(() => {});
            }
          }}
          style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}
        >
          Start Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Orders and Messages - California Sandwiches Winston Churchill</h1>
      <p><strong>Date:</strong> {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <button onClick={() => setShowAccepted(prev => !prev)} style={{ marginRight: '1rem', backgroundColor: 'red', color: 'white', padding: '0.5rem 1rem' }}>
        {showAccepted ? 'Hide Accepted Orders' : 'View Accepted Orders'}
      </button>

      <button onClick={() => setShowReadMessages(prev => !prev)} style={{ marginRight: '1rem', backgroundColor: '#6c757d', color: 'white', padding: '0.5rem 1rem' }}>
        {showReadMessages ? 'Hide Read Messages' : 'View Read Messages'}
      </button>

      <button onClick={() => setShowArchived(prev => !prev)} style={{ backgroundColor: '#343a40', color: 'white', padding: '0.5rem 1rem' }}>
        {showArchived ? 'Hide Archived' : 'View Archived'}
      </button>

      {!showArchived && displayedMessages.map(message => (
        <div key={message.id} style={{ backgroundColor: '#fff3f4', border: '2px solid #ff4081', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
          <h2>📨 New Message</h2>
          <p><strong>Time:</strong> {message['Message Date'] || 'N/A'}</p>
          <p><strong>Caller Name:</strong> {message['Caller_Name'] || 'N/A'}</p>
          <p><strong>Caller Phone:</strong> {message['Caller_Phone'] || 'N/A'}</p>
          <p><strong>Reason:</strong> {message['Message_Reason'] || 'N/A'}</p>
          <button onClick={() => markMessageAsRead(message.id)} style={{ marginTop: '0.5rem', backgroundColor: '#d6336c', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>Mark As Read</button>
        </div>
      ))}

      {!showArchived && <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
        {displayedOrders.map(order => (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
            <h2>Order #{order['Order ID']}</h2>
            <p><strong>Customer:</strong> {order['Customer Name']}</p>
            <p><strong>Order Type:</strong> {order['Order Type'] || 'N/A'}</p>
            {order['Order Type']?.toLowerCase() === 'delivery' && <p><strong>Delivery Address:</strong> {order['Delivery Address']}</p>}
            <p><strong>Order Date:</strong> {order['Order Date']}</p>
            <p><strong>Pickup Time:</strong> {order['Pickup Time']}</p>
            <p><strong>Total:</strong> {order['Total Price']}</p>
            <ul>
              {order['Order Items'].split(',').map((item, index) => <li key={index}>{item.trim()}</li>)}
            </ul>
            {!accepted.has(order.id) && <button onClick={() => acceptOrder(order.id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>ACCEPT</button>}
          </div>
        ))}
      </div>}

      {showArchived && archivedItems.map(item => (
        <div key={item.id} style={{ backgroundColor: '#f4f4f4', border: '1px solid #999', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
          <h2>{item['Order Type'] === 'MESSAGE' ? '📨 Archived Message' : `🗃️ Archived Order #${item['Order ID']}`}</h2>
          <p><strong>Date:</strong> {item['Message Date'] || item['Accepted At']}</p>
          {item['Order Type'] === 'MESSAGE' ? (
            <>
              <p><strong>Caller Name:</strong> {item['Caller_Name']}</p>
              <p><strong>Caller Phone:</strong> {item['Caller_Phone']}</p>
              <p><strong>Reason:</strong> {item['Message_Reason']}</p>
            </>
          ) : (
            <>
              <p><strong>Customer:</strong> {item['Customer Name']}</p>
              <p><strong>Order Type:</strong> {item['Order Type']}</p>
              <p><strong>Delivery Address:</strong> {item['Delivery Address']}</p>
              <p><strong>Pickup Time:</strong> {item['Pickup Time']}</p>
              <p><strong>Total:</strong> {item['Total Price']}</p>
              <ul>
                {item['Order Items'].split(',').map((itemText, index) => <li key={index}>{itemText.trim()}</li>)}
              </ul>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
