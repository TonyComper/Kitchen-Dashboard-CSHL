import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [readMessages, setReadMessages] = useState(new Set(JSON.parse(localStorage.getItem('readMessages') || '[]')));
  const [clearedMessages, setClearedMessages] = useState(new Set(JSON.parse(localStorage.getItem('clearedMessages') || '[]')));
  const [showCleared, setShowCleared] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);
  const messageAudio = useRef(null);

  // Set audio files for alerts
  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
    messageAudio.current = new Audio('/message-alert.mp3');
  }, []);

  // Fetch orders and messages every 5 seconds
  useEffect(() => {
    if (!audioEnabled) return;

    const fetchOrders = async () => {
      const res = await fetch('https://qsr-orders-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();
      const orderArray = Object.entries(data || {}).map(([id, order]) => ({ id, ...order }));

      orderArray.sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));
      setOrders(orderArray);

      orderArray.forEach(order => {
        // Trigger alarm for new orders
        if ((order['Order Type'] === 'PICK UP' || order['Order Type'] === 'DELIVERY') && !accepted.has(order.id)) {
          triggerAlarm(order.id, order['Order Type']); // Trigger alarm for PICK UP or DELIVERY orders
        }
        // Trigger alarm for MESSAGE orders
        if (order['Order Type'] === 'MESSAGE' && !readMessages.has(order.id)) {
          triggerAlarm(order.id, 'MESSAGE'); // Trigger alarm for MESSAGE orders
        }
      });
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [accepted, readMessages, audioEnabled]);

  // Trigger alarm for new orders or messages
  const triggerAlarm = (orderId, orderType) => {
    console.log(`Triggering alarm for ${orderType}:`, orderId);
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);

    // Set an interval to play the alarm sound every 10 seconds
    alarmIntervalRef.current = setInterval(() => {
      if (orderType === 'PICK UP' || orderType === 'DELIVERY') {
        if (!accepted.has(orderId)) {
          alarmAudio.current.play(); // Play alert sound for PICK UP or DELIVERY orders
        } else {
          clearInterval(alarmIntervalRef.current); // Stop alarm when order is accepted
        }
      } else if (orderType === 'MESSAGE') {
        if (!readMessages.has(orderId)) {
          messageAudio.current.play(); // Play message audio for MESSAGE orders
        } else {
          clearInterval(alarmIntervalRef.current); // Stop alarm when message is read
        }
      }
    }, 10000); // Repeats every 10 seconds
  };

  // Accept an order
  const acceptOrder = async (id) => {
    const timestamp = new Date().toISOString();
    setAccepted(prev => {
      const updated = new Set(prev).add(id); // Add order to accepted set
      localStorage.setItem('acceptedOrders', JSON.stringify(Array.from(updated))); // Save accepted orders to localStorage
      return updated;
    });
    await fetch(`https://qsr-orders-default-rtdb.firebaseio.com/orders/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "Accepted At": timestamp })
    });
    clearInterval(alarmIntervalRef.current); // Stop alarm when order is accepted
  };

  // Mark message as read and move to cleared messages
  const markMessageRead = (id) => {
    // Update readMessages and clearedMessages
    setReadMessages(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('readMessages', JSON.stringify(Array.from(updated))); // Save read messages to localStorage
      return updated;
    });

    setClearedMessages(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('clearedMessages', JSON.stringify(Array.from(updated))); // Save cleared messages to localStorage
      return updated;
    });

    // Stop message audio alert when the message is read
    if (messageAudio.current) {
      messageAudio.current.pause();
      messageAudio.current.currentTime = 0; // Reset the audio
    }
    clearInterval(alarmIntervalRef.current); // Stop alarm when message is read
  };

  // Toggle show cleared messages
  const toggleShowCleared = () => setShowCleared(!showCleared);

  // Only display orders if audio is enabled
  if (!audioEnabled) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Orders and Messages</h1>
        <p>Please click the button below to start the dashboard and enable sound alerts.</p>
        <button onClick={() => setAudioEnabled(true)} style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>
          Start Dashboard
        </button>
      </div>
    );
  }

  // Filter orders to show active or cleared messages based on `showCleared`
  const displayedOrders = orders.filter(order => {
    const isAcceptedOrder = accepted.has(order.id);
    const isMessageRead = readMessages.has(order.id);
    return !isMessageRead && !showCleared || (showCleared && clearedMessages.has(order.id)); // Filter based on read status
  }).sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Orders and Messages - California Winston Churchill</h1>

      {/* Button to toggle showing cleared messages */}
      <button onClick={toggleShowCleared} style={{ backgroundColor: '#007bff', color: 'white', padding: '0.5rem 1rem' }}>
        {showCleared ? 'Hide Cleared Messages' : 'View Cleared Messages'}
      </button>

      {/* Displaying messages that are not read yet */}
      <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
        {displayedOrders.map(order => (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
            <h2>Order #{order['Order ID']}</h2>
            <p><strong>Customer:</strong> {order['Customer Name']}</p>
            <p><strong>Order Type:</strong> {order['Order Type'] || 'N/A'}</p>
            {order['Order Type']?.toLowerCase() === 'delivery' && <p><strong>Delivery Address:</strong> {order['Delivery Address']}</p>}
            <p><strong>Order Date:</strong> {order['Order Date']}</p>

            {order['Order Type']?.toLowerCase() === 'message' && !readMessages.has(order.id) && (
              <button onClick={() => markMessageRead(order.id)} style={{ backgroundColor: 'red', color: 'white', marginTop: '1rem' }}>
                READ
              </button>
            )}
            {readMessages.has(order.id) && (
              <p style={{ color: 'green', fontWeight: 'bold' }}>Message Marked as Read</p>
            )}
            {!accepted.has(order.id) && (
              <button onClick={() => acceptOrder(order.id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
                ACCEPT
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
