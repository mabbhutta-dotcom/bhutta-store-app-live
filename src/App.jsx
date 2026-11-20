import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { jsPDF } from 'jspdf';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState('dashboard');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [udharBills, setUdharBills] = useState([]);
  const [profitRows, setProfitRows] = useState([]);
  const [dueReminders, setDueReminders] = useState([]);
  const [itemRequests, setItemRequests] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [name, setName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [productImage, setProductImage] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [barcode, setBarcode] = useState('');

  const [itemName, setItemName] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [billProductSearch, setBillProductSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [sellingPrice, setSellingPrice] = useState('');
  const [cart, setCart] = useState([]);
  const [paidAmount, setPaidAmount] = useState('0');
  const [dueDate, setDueDate] = useState('');

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('General');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(getToday());
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [backupInputKey, setBackupInputKey] = useState(0);

  function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const billTotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
  const remaining = billTotal - Number(paidAmount || 0);
  const todaySales = profitRows
    .filter((r) => r.date === getToday())
    .reduce((s, r) => s + r.sale, 0);
  const todayProfit = profitRows
    .filter((r) => r.date === getToday())
    .reduce((s, r) => s + r.profit, 0);
  const todayExpenses = expenses
    .filter((e) => e.expense_date === getToday())
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const lowStockProducts = products.filter((p) => Number(p.stock) <= 5);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setLoggedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setLoggedIn(!!session);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const channel = supabase
      .channel('store-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        loadProducts
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          if (page === 'products') loadCategories();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          if (page === 'customers') loadCustomers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_requests' },
        () => {
          if (page === 'itemRequests') loadItemRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        loadExpenses
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          if (page === 'udhar') loadUdharRecords();
          if (page === 'dashboard') loadDueReminders();
          if (page === 'profits' || page === 'dailyReport') loadProfitReports();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => {
          if (page === 'udhar') loadUdharRecords();
          if (page === 'dashboard') loadDueReminders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          if (page === 'profits' || page === 'dailyReport') loadProfitReports();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loggedIn, page]);

  useEffect(() => {
    if (loggedIn && page === 'dashboard') {
      loadProducts();
      loadCustomers();
      loadProfitReports();
      loadExpenses();
      loadDueReminders();
    }
  }, [loggedIn, page]);

  useEffect(() => {
    if (!scannerOpen) return;
    const scanner = new Html5QrcodeScanner(
      'barcode-reader',
      { fps: 10, qrbox: { width: 230, height: 130 } },
      false
    );
    scanner.render(
      (decodedText) => {
        setBarcodeSearch(decodedText);
        const found = products.find(
          (p) => String(p.barcode || '') === String(decodedText)
        );
        if (found) {
          setSelectedProduct(String(found.id));
          setSellingPrice(String(found.price || ''));
          setMessage('Barcode mil gaya: ' + found.name);
        } else {
          setMessage(
            'Is barcode ka product nahi mila. Product mein barcode save karein.'
          );
        }
        scanner.clear().catch(() => {});
        setScannerOpen(false);
      },
      () => {}
    );
    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scannerOpen, products]);

  const login = async () => {
    if (!email || !password) return setMessage('Email aur password likhein.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) setMessage(error.message);
    else {
      setLoggedIn(true);
      setMessage('');
      await loadDueReminders();
      await loadProducts();
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setPage('dashboard');
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else setProducts(data || []);
  };
  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id');
    if (error) setMessage(error.message);
    else setCategories(data || []);
  };
  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else setCustomers(data || []);
  };
  const loadExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (error) setMessage(error.message);
    else setExpenses(data || []);
  };
  const loadItemRequests = async () => {
    const { data, error } = await supabase
      .from('item_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else setItemRequests(data || []);
  };

  const openProducts = async () => {
    setPage('products');
    setMessage('');
    await Promise.all([loadCategories(), loadProducts()]);
  };
  const openCustomers = async () => {
    setPage('customers');
    setMessage('');
    await loadCustomers();
  };
  const openStock = async () => {
    setPage('stock');
    setMessage('');
    await loadProducts();
  };
  const openExpenses = async () => {
    setPage('expenses');
    setMessage('');
    await loadExpenses();
  };
  const openItemRequests = async () => {
    setPage('itemRequests');
    setMessage('');
    setItemName('');
    await loadItemRequests();
  };

  const clearForm = () => {
    setName('');
    setBuyPrice('');
    setStock('');
    setCategoryId('');
    setDescription('');
    setBarcode('');
    setProductImage(null);
    setEditingId(null);
  };

  const saveProduct = async () => {
    if (!name.trim() || buyPrice === '' || stock === '' || !categoryId)
      return setMessage('Tamam zaroori details fill karein.');
    if (Number(buyPrice) < 0 || Number(stock) < 0)
      return setMessage('Price aur stock negative nahi ho sakte.');
    let imageUrl = editingId
      ? products.find((p) => String(p.id) === String(editingId))?.image_url ||
        null
      : null;
    if (productImage) {
      const extension = (
        productImage.name.split('.').pop() || 'jpg'
      ).toLowerCase();
      const filePath = `products/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, productImage, {
          upsert: true,
          contentType: productImage.type || 'image/jpeg',
        });
      if (uploadError) {
        setLoading(false);
        return setMessage('Picture upload nahi hui: ' + uploadError.message);
      }
      imageUrl = supabase.storage.from('product-images').getPublicUrl(filePath)
        .data.publicUrl;
    }
    const product = {
      name: name.trim(),
      description,
      buy_price: Number(buyPrice),
      stock: Number(stock),
      category_id: Number(categoryId),
      is_active: true,
      barcode: barcode.trim() || null,
      image_url: imageUrl,
    };
    setLoading(true);
    const result = editingId
      ? await supabase.from('products').update(product).eq('id', editingId)
      : await supabase.from('products').insert([{ ...product, price: 0 }]);
    setLoading(false);
    if (result.error) return setMessage(result.error.message);
    clearForm();
    setShowProductForm(false);
    await loadProducts();
    setMessage('Product save ho gaya!');
  };

  const editProduct = (p) => {
    setShowProductForm(true);
    setEditingId(p.id);
    setName(p.name || '');
    setBuyPrice(String(p.buy_price ?? 0));
    setStock(String(p.stock ?? 0));
    setCategoryId(String(p.category_id || ''));
    setDescription(p.description || '');
    setBarcode(p.barcode || '');
    setProductImage(null);
    setMessage('');
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Kya aap ye product delete karna chahte hain?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) setMessage(error.message);
    else {
      await loadProducts();
      setMessage('Product delete ho gaya.');
    }
  };

  const loadUdharRecords = async () => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['partial', 'udhaar'])
      .order('created_at', { ascending: false });
    if (error) return setMessage(error.message);
    if (!orders?.length) {
      setUdharBills([]);
      return;
    }
    const ids = orders.map((o) => o.id);
    const { data: payments, error: pe } = await supabase
      .from('payments')
      .select('*')
      .in('order_id', ids)
      .order('created_at', { ascending: false });
    if (pe) return setMessage(pe.message);
    setUdharBills(
      orders
        .map((order) => {
          const billPayments = (payments || []).filter(
            (p) => p.order_id === order.id
          );
          const paid = billPayments.reduce(
            (s, p) => s + Number(p.amount || 0),
            0
          );
          return {
            ...order,
            paid,
            balance: Math.max(0, Number(order.total || 0) - paid),
            payments: billPayments,
          };
        })
        .filter((o) => o.balance > 0)
    );
  };
  const openUdhar = async () => {
    setPage('udhar');
    setMessage('');
    await loadUdharRecords();
  };

  const saveUdharPayment = async (bill) => {
    const amount = Number(paymentAmounts[bill.id] || 0);
    if (!amount || amount <= 0) return setMessage('Payment amount likhein.');
    if (amount > bill.balance)
      return setMessage('Payment baqi udhaar se zyada nahi ho sakti.');
    setLoading(true);
    const { error } = await supabase.from('payments').insert([
      {
        customer_id: bill.customer_id,
        order_id: bill.id,
        amount,
        payment_method: paymentMethod,
        note: 'Udhaar payment',
      },
    ]);
    if (error) {
      setLoading(false);
      return setMessage(error.message);
    }
    const newBalance = bill.balance - amount;
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newBalance <= 0 ? 'paid' : 'partial' })
      .eq('id', bill.id);
    setLoading(false);
    if (updateError)
      setMessage(
        'Payment save ho gayi lekin bill status update nahi hua: ' +
          updateError.message
      );
    else {
      setPaymentAmounts((old) => ({ ...old, [bill.id]: '' }));
      setMessage('Payment successfully save ho gayi!');
    }
    await loadUdharRecords();
    await loadDueReminders();
  };

  const loadProfitReports = async () => {
    const { data, error } = await supabase
      .from('order_items')
      .select(
        'id, order_id, quantity, price, buy_price, orders(id, customer_name, created_at)'
      )
      .order('id', { ascending: false });
    if (error) return setMessage('Profit report error: ' + error.message);
    const grouped = {};
    (data || []).forEach((item) => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      if (!order) return;
      if (!grouped[item.order_id])
        grouped[item.order_id] = {
          order_id: item.order_id,
          customer_name: order.customer_name,
          created_at: order.created_at,
          date: String(order.created_at).slice(0, 10),
          sale: 0,
          cost: 0,
          profit: 0,
        };
      const qty = Number(item.quantity || 0);
      const sale = Number(item.price || 0) * qty;
      const cost = Number(item.buy_price || 0) * qty;
      grouped[item.order_id].sale += sale;
      grouped[item.order_id].cost += cost;
      grouped[item.order_id].profit += sale - cost;
    });
    setProfitRows(Object.values(grouped));
  };
  const openProfitReports = async () => {
    setPage('profits');
    setMessage('');
    await loadProfitReports();
  };
  const openDailyReport = async () => {
    setPage('dailyReport');
    setMessage('');
    await Promise.all([loadProfitReports(), loadExpenses()]);
  };

  const saveExpense = async () => {
    if (
      !expenseTitle.trim() ||
      expenseAmount === '' ||
      Number(expenseAmount) <= 0
    )
      return setMessage('Expense ka naam aur sahi amount likhein.');
    setLoading(true);
    const { error } = await supabase.from('expenses').insert([
      {
        title: expenseTitle.trim(),
        category: expenseCategory,
        amount: Number(expenseAmount),
        expense_date: expenseDate || getToday(),
        note: expenseNote,
      },
    ]);
    setLoading(false);
    if (error) return setMessage(error.message);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseNote('');
    setMessage('Expense save ho gaya!');
    await loadExpenses();
  };
  const deleteExpense = async (id) => {
    if (!window.confirm('Kya aap ye expense delete karna chahte hain?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) setMessage(error.message);
    else {
      setMessage('Expense delete ho gaya.');
      await loadExpenses();
    }
  };

  const loadDueReminders = async () => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, customer_name, phone, due_date, total, status')
      .not('due_date', 'is', null)
      .neq('status', 'paid')
      .lte('due_date', getToday())
      .order('due_date', { ascending: true });
    if (error) return setMessage('Reminder error: ' + error.message);
    if (!orders?.length) {
      setDueReminders([]);
      return;
    }
    const ids = orders.map((o) => o.id);
    const { data: payments, error: pe } = await supabase
      .from('payments')
      .select('order_id, amount')
      .in('order_id', ids);
    if (pe) return setMessage(pe.message);
    setDueReminders(
      orders
        .map((order) => {
          const paid = (payments || [])
            .filter((p) => p.order_id === order.id)
            .reduce((s, p) => s + Number(p.amount || 0), 0);
          return {
            ...order,
            balance: Math.max(0, Number(order.total || 0) - paid),
          };
        })
        .filter((o) => o.balance > 0)
    );
  };

  const whatsappReminder = (bill) => {
    const digits = String(bill.phone || '').replace(/\D/g, '');
    if (!digits) {
      setMessage('Is customer ka mobile number mojood nahi hai.');
      return;
    }
    const number = digits.startsWith('0') ? '92' + digits.slice(1) : digits;
    const text = `Assalam-o-Alaikum ${
      bill.customer_name || ''
    }, Bhutta Shoes and Plastic Store ki taraf se yaad-dihani: Bill #${
      bill.id
    } ka Rs. ${Number(bill.balance).toFixed(2)} udhaar baqi hai. Due date: ${
      bill.due_date || '-'
    }. Meharbani farma kar payment kar dein. Shukriya.`;
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const chooseDueDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
    );
  };
  const openBill = async () => {
    setPage('bill');
    setMessage('');
    setCart([]);
    setCustomerName('');
    setPhone('');
    setAddress('');
    setPaidAmount('0');
    setDueDate('');
    setSelectedProduct('');
    setBillProductSearch('');
    setSellingPrice('');
    setQuantity('1');
    setBarcodeSearch('');
    await loadProducts();
  };

  const addScannedOrSelectedProduct = (product) => {
    if (!product) return setMessage('Product nahi mila.');
    setSelectedProduct(String(product.id));
    setSellingPrice(String(product.price || ''));
    setBarcodeSearch(product.barcode || '');
    setMessage('Product select ho gaya: ' + product.name);
  };

  const addToCart = () => {
    const product = products.find(
      (p) => String(p.id) === String(selectedProduct)
    );
    if (!product) return setMessage('Product select karein.');
    const qty = Number(quantity),
      price = Number(sellingPrice);
    if (!Number.isInteger(qty) || qty <= 0 || price < 0 || sellingPrice === '')
      return setMessage('Quantity aur selling price theek likhein.');
    const already = cart
      .filter((i) => i.product_id === product.id)
      .reduce((s, i) => s + i.quantity, 0);
    if (already + qty > Number(product.stock))
      return setMessage(
        'Itna stock available nahi hai. Available stock: ' + product.stock
      );
    const existingIndex = cart.findIndex(
      (item) => item.product_id === product.id
    );
    if (existingIndex >= 0) {
      setCart(
        cart.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + qty, price }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          quantity: qty,
          price,
          buy_price: Number(product.buy_price || 0),
        },
      ]);
    }
    setSelectedProduct('');
    setSellingPrice('');
    setQuantity('1');
    setBarcodeSearch('');
    setMessage('');
  };
  const removeCartItem = (index) => setCart(cart.filter((_, i) => i !== index));

  const downloadBillPdf = (bill, items, paid, due) => {
    // A4 portrait customer invoice styled to match the approved bill template.
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const W = 210,
      H = 297,
      navy = [5, 35, 83],
      blue = [42, 119, 207];
    const pale = [229, 240, 255],
      yellow = [255, 210, 0],
      green = [12, 143, 75];
    const left = 8,
      right = 202,
      innerW = right - left;
    const fmt = (v) =>
      Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
    const dateText = new Date().toLocaleDateString('en-GB');
    const remainingAmount = Math.max(
      0,
      Number(bill.total || 0) - Number(paid || 0)
    );
    const moneyText = (v) => `PKR ${fmt(v)}`;

    // Outer frame and decorative brand header.
    doc.setDrawColor(...navy);
    doc.setLineWidth(1.1);
    doc.roundedRect(3, 3, 204, 291, 7, 7, 'S');
    doc.setFillColor(...navy);
    doc.roundedRect(23, 6, 164, 34, 15, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(23);
    doc.text('Bhutta Shoes &', 105, 20, { align: 'center' });
    doc.setTextColor(255, 218, 0);
    doc.setFontSize(22);
    doc.text('Plastic Store', 105, 31, { align: 'center' });
    doc.setTextColor(...navy);
    doc.setFontSize(12);
    doc.text('Created by Muhammad Rashid Bhutta', 105, 47, { align: 'center' });
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.7);
    doc.line(18, 45, 42, 45);
    doc.line(168, 45, 192, 45);

    // Owners' details panels.
    doc.setFillColor(...pale);
    doc.setDrawColor(139, 190, 248);
    doc.roundedRect(7, 52, 96, 25, 3, 3, 'FD');
    doc.roundedRect(107, 52, 96, 25, 3, 3, 'FD');
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Muhammad Rashid Bhutta', 55, 62, { align: 'center' });
    doc.setFontSize(14);
    doc.text('☎  03017623456', 55, 71, { align: 'center' });
    doc.setFillColor(...navy);
    doc.roundedRect(144, 51, 22, 7, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text('Owner', 155, 56, { align: 'center' });
    doc.setTextColor(...navy);
    doc.setFontSize(10);
    doc.text('Muhammad Asif Bhutta', 155, 64, { align: 'center' });
    doc.text('Muhammad Sajid Bhutta', 155, 72, { align: 'center' });

    // Bill title band.
    doc.setFillColor(...navy);
    doc.roundedRect(7, 80, 196, 15, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('CUSTOMER BILL', 105, 90.5, { align: 'center' });

    // Customer and bill metadata.
    doc.setFillColor(248, 251, 255);
    doc.roundedRect(8, 98, 194, 27, 3, 3, 'F');
    doc.setTextColor(...navy);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Name:', 13, 108);
    doc.text('Date:', 13, 119);
    doc.text('Bill No:', 132, 108);
    doc.text('Cashier:', 132, 119);
    doc.setDrawColor(115, 164, 220);
    doc.setLineWidth(0.5);
    doc.roundedRect(52, 101, 70, 9, 2, 2, 'S');
    doc.roundedRect(52, 112, 70, 9, 2, 2, 'S');
    doc.roundedRect(157, 101, 40, 9, 2, 2, 'S');
    doc.roundedRect(157, 112, 40, 9, 2, 2, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(20, 38, 67);
    doc.text(
      doc.splitTextToSize(String(bill.customer_name || '-'), 66),
      55,
      107.5
    );
    doc.text(dateText, 55, 118.5);
    doc.text(String(bill.id), 161, 107.5);
    doc.text('Shop Owner', 161, 118.5);

    // Product table with five visible rows minimum, like the supplied sample.
    const tableX = 8,
      tableY = 130,
      tableW = 194,
      headerH = 14,
      rowH = 13;
    const cols = [17, 79, 27, 36, 35];
    const x = [tableX];
    for (const width of cols) x.push(x[x.length - 1] + width);
    doc.setFillColor(...navy);
    doc.roundedRect(tableX, tableY, tableW, headerH, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    ['#', 'Product', 'Qty', 'Rate (PKR)', 'Total (PKR)'].forEach((label, i) =>
      doc.text(label, (x[i] + x[i + 1]) / 2, tableY + 9, { align: 'center' })
    );
    const visibleRows = Math.max(5, items.length);
    let rowY = tableY + headerH;
    doc.setDrawColor(36, 83, 145);
    doc.setLineWidth(0.35);
    for (let i = 0; i < visibleRows; i++) {
      doc.rect(tableX, rowY, tableW, rowH, 'S');
      for (let c = 1; c < x.length - 1; c++)
        doc.line(x[c], rowY, x[c], rowY + rowH);
      if (items[i]) {
        const item = items[i];
        doc.setTextColor(15, 28, 45);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.text(String(i + 1), (x[0] + x[1]) / 2, rowY + 8.5, {
          align: 'center',
        });
        doc.text(
          doc.splitTextToSize(String(item.name || ''), 74).slice(0, 1),
          x[1] + 3,
          rowY + 8.5
        );
        doc.text(String(item.quantity), (x[2] + x[3]) / 2, rowY + 8.5, {
          align: 'center',
        });
        doc.text(fmt(item.price), x[4] - 2, rowY + 8.5, { align: 'right' });
        doc.text(
          fmt(Number(item.quantity) * Number(item.price)),
          x[5] - 2,
          rowY + 8.5,
          { align: 'right' }
        );
      } else {
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(String(i + 1), (x[0] + x[1]) / 2, rowY + 8.5, {
          align: 'center',
        });
      }
      rowY += rowH;
    }

    // Payment panel and totals.
    const panelY = rowY + 5;
    doc.setFillColor(...pale);
    doc.setDrawColor(139, 190, 248);
    doc.roundedRect(8, panelY, 111, 42, 3, 3, 'FD');
    doc.setFillColor(...navy);
    doc.roundedRect(11, panelY + 2, 66, 9, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Payment Details:', 15, panelY + 8.5);
    doc.setTextColor(...navy);
    doc.setFontSize(11);
    doc.text('Cash Paid:', 15, panelY + 22);
    doc.text('Remaining Amount:', 15, panelY + 35);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.text(fmt(paid), 112, panelY + 22, { align: 'right' });
    doc.text(fmt(remainingAmount), 112, panelY + 35, { align: 'right' });

    const totalsX = 124,
      totalsW = 78;
    doc.setFillColor(...navy);
    doc.roundedRect(totalsX, panelY, totalsW, 12, 3, 3, 'F');
    doc.roundedRect(totalsX, panelY + 14, totalsW, 12, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Sub Total:', totalsX + 4, panelY + 8);
    doc.text(fmt(bill.total), totalsX + totalsW - 4, panelY + 8, {
      align: 'right',
    });
    doc.text('Discount:', totalsX + 4, panelY + 22);
    doc.text('0', totalsX + totalsW - 4, panelY + 22, { align: 'right' });
    doc.setFillColor(...yellow);
    doc.roundedRect(totalsX, panelY + 28, totalsW, 14, 3, 3, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Grand Total:', totalsX + 3, panelY + 37);
    doc.setFontSize(13);
    doc.text(fmt(bill.total), totalsX + totalsW - 3, panelY + 37, {
      align: 'right',
    });

    // Due date (only when there is an outstanding balance).
    if (due) {
      doc.setTextColor(...navy);
      doc.setFontSize(9);
      doc.text(`Due Date: ${due}`, 12, panelY + 49);
    }

    // Signature panels and thank-you footer.
    const footerY = Math.min(265, panelY + 58);
    doc.setDrawColor(45, 105, 180);
    doc.roundedRect(8, footerY, 57, 39, 4, 4, 'S');
    doc.roundedRect(145, footerY, 57, 39, 4, 4, 'S');
    doc.setDrawColor(...navy);
    doc.line(12, footerY + 25, 61, footerY + 25);
    doc.line(149, footerY + 25, 198, footerY + 25);
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Customer Signature', 36.5, footerY + 32, { align: 'center' });
    doc.text('Authorized Signature', 173.5, footerY + 32, { align: 'center' });
    doc.setFont('times', 'italic');
    doc.setFontSize(24);
    doc.text('Thank You!', 105, footerY + 18, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Visit Again!', 105, footerY + 32, { align: 'center' });
    if (remainingAmount > 0 && due) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Payment due: ${due}`, 105, 289, { align: 'center' });
    }
    doc.save(`Bhutta-Store-Bill-${bill.id}.pdf`);
  };

  const saveBill = async () => {
    if (!customerName.trim()) return setMessage('Customer ka naam likhein.');
    if (!cart.length)
      return setMessage('Bill mein kam az kam aik product add karein.');
    const paid = Number(paidAmount || 0);
    if (!Number.isFinite(paid) || paid < 0 || paid > billTotal)
      return setMessage(
        'Paid amount total bill se zyada ya negative nahi ho sakta.'
      );
    if (paid < billTotal && !dueDate)
      return setMessage('Udhaar ki wapsi ki date select karein.');

    // Stock dobara server se check hota hai taake doosre device ki sale se stock negative na ho.
    setLoading(true);
    setMessage('');
    const stockBefore = [];
    for (const item of cart) {
      const { data: p, error } = await supabase
        .from('products')
        .select('id, stock')
        .eq('id', item.product_id)
        .single();
      if (error || !p || Number(p.stock) < item.quantity) {
        setLoading(false);
        return setMessage(
          error?.message ||
            `Maazrat, ${item.name} ka stock ab ${
              p?.stock ?? 0
            } hai. Bill dobara check karein.`
        );
      }
      stockBefore.push({
        id: p.id,
        stock: Number(p.stock),
        quantity: item.quantity,
        name: item.name,
      });
    }

    let customerId = null;
    if (phone.trim()) {
      const { data: oldCustomer, error: findError } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone.trim())
        .maybeSingle();
      if (findError) {
        setLoading(false);
        return setMessage(findError.message);
      }
      if (oldCustomer) {
        customerId = oldCustomer.id;
        const { error: customerUpdateError } = await supabase
          .from('customers')
          .update({ name: customerName.trim() })
          .eq('id', customerId);
        if (customerUpdateError) {
          setLoading(false);
          return setMessage(customerUpdateError.message);
        }
      }
    }
    if (!customerId) {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert([{ name: customerName.trim(), phone: phone.trim() || null }])
        .select('id')
        .single();
      if (error) {
        setLoading(false);
        return setMessage(error.message);
      }
      customerId = newCustomer.id;
    }

    const status =
      paid === billTotal ? 'paid' : paid > 0 ? 'partial' : 'udhaar';
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          total: billTotal,
          status,
          customer_id: customerId,
          due_date: paid < billTotal ? dueDate : null,
        },
      ])
      .select('id')
      .single();
    if (orderError) {
      setLoading(false);
      return setMessage(orderError.message);
    }

    const insertedItems = [];
    for (const item of cart) {
      const { data, error } = await supabase
        .from('order_items')
        .insert([
          {
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            buy_price: item.buy_price,
          },
        ])
        .select('id')
        .single();
      if (error) {
        for (const saved of insertedItems)
          await supabase.from('order_items').delete().eq('id', saved.id);
        await supabase.from('orders').delete().eq('id', order.id);
        setLoading(false);
        return setMessage(error.message);
      }
      insertedItems.push(data);
    }

    if (paid > 0) {
      const { error } = await supabase.from('payments').insert([
        {
          customer_id: customerId,
          order_id: order.id,
          amount: paid,
          payment_method: paymentMethod,
          note: 'Bill payment',
        },
      ]);
      if (error) {
        for (const saved of insertedItems)
          await supabase.from('order_items').delete().eq('id', saved.id);
        await supabase.from('orders').delete().eq('id', order.id);
        setLoading(false);
        return setMessage('Payment save nahi hui: ' + error.message);
      }
    }

    const deducted = [];
    for (const old of stockBefore) {
      const { error } = await supabase
        .from('products')
        .update({ stock: old.stock - old.quantity })
        .eq('id', old.id);
      if (error) {
        for (const done of deducted)
          await supabase
            .from('products')
            .update({ stock: done.stock })
            .eq('id', done.id);
        for (const saved of insertedItems)
          await supabase.from('order_items').delete().eq('id', saved.id);
        await supabase.from('payments').delete().eq('order_id', order.id);
        await supabase.from('orders').delete().eq('id', order.id);
        setLoading(false);
        return setMessage(
          'Stock update nahi hua, bill cancel kar diya gaya: ' + error.message
        );
      }
      deducted.push(old);
    }

    const billInfo = {
      id: order.id,
      customer_name: customerName.trim(),
      phone: phone.trim(),
      total: billTotal,
    };
    const itemsForPdf = [...cart];
    downloadBillPdf(
      billInfo,
      itemsForPdf,
      paid,
      paid < billTotal ? dueDate : ''
    );
    setLoading(false);
    await Promise.all([
      loadProducts(),
      loadDueReminders(),
      loadProfitReports(),
    ]);
    setCart([]);
    setCustomerName('');
    setPhone('');
    setAddress('');
    setPaidAmount('0');
    setDueDate('');
    setMessage(
      `Bill successfully save ho gaya! Bill number: ${order.id}. PDF download shuru ho gaya.`
    );
  };

  const exportBackup = async () => {
    setLoading(true);
    const tables = [
      'categories',
      'customers',
      'products',
      'orders',
      'order_items',
      'payments',
      'item_requests',
      'shop_state',
      'expenses',
    ];
    const backup = {
      app: 'Bhutta Shoes and Plastic Store',
      version: 1,
      exported_at: new Date().toISOString(),
      tables: {},
    };
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        setLoading(false);
        return setMessage(
          `Backup ${table} table par ruk gaya: ${error.message}`
        );
      }
      backup.tables[table] = data || [];
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bhutta-Store-Backup-${getToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
    setMessage('Backup file download ho gayi.');
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !window.confirm(
        'Backup restore karne se pehle confirm karein. Ye existing records ko matching IDs par update aur naye records insert karega. Kya continue karein?'
      )
    ) {
      event.target.value = '';
      return;
    }
    setLoading(true);
    try {
      const backup = JSON.parse(await file.text());
      if (!backup.tables || !backup.tables.products || !backup.tables.orders)
        throw new Error('Ye valid store backup file nahi lagti.');
      const order = [
        'categories',
        'customers',
        'products',
        'orders',
        'order_items',
        'payments',
        'item_requests',
        'shop_state',
        'expenses',
      ];
      for (const table of order) {
        const rows = backup.tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const { error } = await supabase.from(table).upsert(rows);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
      setMessage('Backup restore ho gaya. App ka data refresh ho raha hai.');
      await Promise.all([
        loadProducts(),
        loadCategories(),
        loadCustomers(),
        loadExpenses(),
        loadDueReminders(),
        loadProfitReports(),
      ]);
    } catch (e) {
      setMessage('Restore error: ' + e.message);
    } finally {
      setLoading(false);
      setBackupInputKey((k) => k + 1);
    }
  };

  const saveItemRequest = async () => {
    if (!itemName.trim()) return setMessage('Item ka naam likhein.');
    setLoading(true);
    const { error } = await supabase
      .from('item_requests')
      .insert([{ item_name: itemName.trim() }]);
    setLoading(false);
    if (error) return setMessage(error.message);
    setItemName('');
    setMessage('Item request save ho gayi!');
    await loadItemRequests();
  };
  const deleteItemRequest = async (id) => {
    if (!window.confirm('Kya aap ye item request delete karna chahte hain?'))
      return;
    const { error } = await supabase
      .from('item_requests')
      .delete()
      .eq('id', id);
    if (error) setMessage(error.message);
    else {
      setMessage('Item request delete ho gayi.');
      await loadItemRequests();
    }
  };

  const sendWhatsAppForBill = (bill) => whatsappReminder(bill);
  const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

  if (!loggedIn)
    return (
      <div style={styles.center}>
        <div style={styles.box}>
          <h2 style={{ color: '#10243A', textAlign: 'center' }}>
            Bhutta Shoes & Plastic Store
          </h2>
          <p
            style={{ textAlign: 'center', color: '#168B65', fontWeight: '600' }}
          >
            Created by Muhammad Rashid Bhutta
          </p>
          <h3 style={{ textAlign: 'center' }}>Owner Login</h3>
          <input
            style={styles.input}
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button style={styles.green} onClick={login} disabled={loading}>
            {loading ? 'Please wait...' : 'Login'}
          </button>
          <p>{message}</p>
        </div>
      </div>
    );

  return (
    <div style={styles.appShell}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #eef4ff; }
        .store-frame { min-height:100vh; background:linear-gradient(135deg,#eaf2ff,#f8fbff); color:#09265c; font-family:Inter,Arial,sans-serif; }
        .store-top { height:58px; background:linear-gradient(90deg,#061b43,#0b3474); color:#fff; display:flex; align-items:center; justify-content:flex-end; gap:18px; padding:0 24px; box-shadow:0 3px 14px #08285b33; }
        .store-layout { display:grid; grid-template-columns:224px minmax(0,1fr); gap:0; max-width:1600px; min-height:calc(100vh - 58px); margin:auto; padding:0 12px 12px; }
        .store-side { background:linear-gradient(180deg,#061b43,#0b3474); color:white; padding:18px 10px; border-radius:0 0 14px 14px; box-shadow:0 8px 24px #08285b22; }
        .store-brand { padding:8px 10px 20px; border-bottom:1px solid #ffffff2b; margin-bottom:14px; }
        .store-brand-mark { width:44px;height:44px;border-radius:13px;background:#fff;color:#09265c;display:grid;place-items:center;font-size:24px;font-weight:900;margin-bottom:10px; }
        .store-nav { display:flex;align-items:center;gap:10px;width:100%;border:0;border-radius:9px;padding:11px 10px;margin:3px 0;background:transparent;color:#eaf2ff;text-align:left;font-size:13px;font-weight:650;cursor:pointer; }
        .store-nav.active { background:linear-gradient(90deg,#1595ff,#0873e7);color:white;box-shadow:0 4px 12px #0084ff55; }
        .store-main { min-width:0; margin:12px 0 0 12px; background:#f7faff; border:1px solid #d7e5ff; border-radius:15px; padding:22px; box-shadow:0 6px 22px #09265c12; }
        .store-main h3 { color:#09265c; margin-top:4px; }
        .store-main h4 { color:#12336c; }
        .store-main button { border-radius:8px!important; font-weight:700; transition:transform .15s,box-shadow .15s; }
        .store-main button:hover { transform:translateY(-1px);box-shadow:0 5px 13px #09265c22; }
        .store-main input,.store-main select { border:1px solid #cbdcf8!important;border-radius:8px!important;background:#fff;min-height:39px;color:#102b5e; }
        .store-main [style*="border: 1px solid #ddd"], .store-main [style*="border:1px solid #ddd"] { border-color:#d7e5fb!important; background:#fff; border-radius:12px!important; box-shadow:0 3px 12px #12376b0c; }
        .store-main img { object-fit:contain!important; background:#f0f5ff!important; }
        .store-main table { border-collapse:collapse; width:100%; }
        .store-main th { background:#e8f1ff; color:#09265c; }
        .store-stat { border-radius:12px; padding:16px; border:1px solid #cfe0ff; background:linear-gradient(135deg,#e6f0ff,#fff); box-shadow:0 3px 12px #0a367515; }
        .store-stat strong { display:block;font-size:24px;color:#09265c;margin-top:7px; }
        .store-message { color:#0b6d48;font-weight:700; }
        @media(max-width:850px){.store-layout{grid-template-columns:1fr;padding:0 8px 8px}.store-side{border-radius:0 0 12px 12px;position:static}.store-nav{display:inline-flex;width:auto;margin:3px}.store-brand{display:flex;align-items:center;gap:12px;padding-bottom:10px}.store-brand-mark{margin:0}.store-main{margin:10px 0;padding:14px}.store-top{height:52px}}
      `}</style>
      <div className="store-frame">
        <header className="store-top">
          <span style={{ color: '#6ee7b7', fontSize: 12, fontWeight: 800 }}>
            ● SHOP OPEN
          </span>
          <span style={{ fontSize: 18 }}>🔔</span>
          <span
            style={{
              background: '#fff',
              color: '#09265c',
              borderRadius: 20,
              padding: '6px 9px',
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            RB
          </span>
        </header>
        <div className="store-layout">
          <aside className="store-side">
            <div className="store-brand">
              <div className="store-brand-mark">🛍</div>
              <div>
                <b style={{ fontSize: 14, lineHeight: 1.35 }}>
                  Bhutta Shoes &<br />
                  Plastic Store
                </b>
                <div style={{ fontSize: 9, color: '#c7dcff', marginTop: 4 }}>
                  Created by Muhammad
                  <br />
                  Rashid Bhutta
                </div>
              </div>
            </div>
            {[
              ['dashboard', '⌂', 'Dashboard'],
              ['bill', '▣', 'New Bill'],
              ['udhar', '🛒', 'Manage Orders'],
              ['customers', '♙', 'Customers'],
              ['products', '⬡', 'Products'],
              ['udhar', '▤', 'Payments'],
              ['udhar', '◉', 'Udhaar'],
              ['profits', '▥', 'Reports'],
              ['expenses', '⚙', 'Expenses'],
              ['itemRequests', '✚', 'Item Requests'],
              ['stock', '▦', 'Stock'],
            ].map(([key, icon, label], index) => (
              <button
                key={`${key}-${label}`}
                className={`store-nav ${
                  page === key &&
                  ((label !== 'Payments' && label !== 'Udhaar') ||
                    page === 'udhar')
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  setPage(key);
                  setMessage('');
                  if (key === 'products') openProducts();
                  if (key === 'customers') openCustomers();
                  if (key === 'udhar') openUdhar();
                  if (key === 'stock') openStock();
                  if (key === 'expenses') openExpenses();
                  if (key === 'itemRequests') openItemRequests();
                  if (key === 'profits') openProfitReports();
                  if (key === 'bill') openBill();
                }}
              >
                <span style={{ width: 20, fontSize: 16 }}>{icon}</span>
                {label}
              </button>
            ))}
            <div
              style={{
                borderTop: '1px solid #ffffff2b',
                marginTop: 12,
                paddingTop: 12,
              }}
            >
              <button
                className="store-nav"
                onClick={exportBackup}
                disabled={loading}
              >
                ⬇ Download Backup
              </button>
              <label className="store-nav">
                ↥ Restore Backup
                <input
                  key={backupInputKey}
                  type="file"
                  accept=".json,application/json"
                  onChange={importBackup}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                className="store-nav"
                style={{
                  background: '#ef3340',
                  marginTop: 12,
                  justifyContent: 'center',
                }}
                onClick={logout}
              >
                ⏻ Logout
              </button>
            </div>
          </aside>
          <main className="store-main">
            {page === 'dashboard' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <h2 style={{ margin: '0 0 4px', color: '#09265c' }}>
                      ⌂ Dashboard
                    </h2>
                    <span style={{ color: '#55709a', fontSize: 13 }}>
                      Welcome to Bhutta Shoes & Plastic Store
                    </span>
                  </div>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#087443',
                      padding: '7px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    ● Shop Open
                  </span>
                </div>
                <div style={styles.statsGrid}>
                  <div className="store-stat">
                    <span>Total Bills</span>
                    <strong>{profitRows.length}</strong>
                    <small>All recorded bills</small>
                  </div>
                  <div
                    className="store-stat"
                    style={{
                      background: 'linear-gradient(135deg,#dcfce7,#fff)',
                      borderColor: '#b7ebcf',
                    }}
                  >
                    <span>Total Sales Today</span>
                    <strong>{money(todaySales)}</strong>
                    <small>Today's sales</small>
                  </div>
                  <div
                    className="store-stat"
                    style={{
                      background: 'linear-gradient(135deg,#f1eaff,#fff)',
                      borderColor: '#dfd0ff',
                    }}
                  >
                    <span>Customers</span>
                    <strong>{customers.length}</strong>
                    <small>Registered customers</small>
                  </div>
                  <div
                    className="store-stat"
                    style={{
                      background: 'linear-gradient(135deg,#fff0df,#fff)',
                      borderColor: '#ffdbb4',
                    }}
                  >
                    <span>Products</span>
                    <strong>{products.length}</strong>
                    <small>Items in inventory</small>
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,2fr) minmax(220px,1fr)',
                    gap: 14,
                    margin: '12px 0',
                  }}
                >
                  <section
                    style={{
                      background: '#fff',
                      border: '1px solid #d9e6fb',
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>⚡ Quick Actions</h3>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit,minmax(105px,1fr))',
                        gap: 9,
                      }}
                    >
                      <button
                        style={{ ...styles.blue, background: '#1769ed' }}
                        onClick={openBill}
                      >
                        ▣<br />
                        New Bill
                      </button>
                      <button
                        style={{ ...styles.green, background: '#08a77b' }}
                        onClick={openUdhar}
                      >
                        🛒
                        <br />
                        Manage Orders
                      </button>
                      <button
                        style={{ ...styles.blue, background: '#7c3aed' }}
                        onClick={openCustomers}
                      >
                        ♙<br />
                        Add Customer
                      </button>
                      <button
                        style={{ ...styles.blue, background: '#f59e0b' }}
                        onClick={openProducts}
                      >
                        ⬡<br />
                        Add Product
                      </button>
                      <button
                        style={{ ...styles.blue, background: '#06a6c8' }}
                        onClick={openUdhar}
                      >
                        ▤<br />
                        Payments
                      </button>
                      <button
                        style={{ ...styles.red, background: '#ef476f' }}
                        onClick={openUdhar}
                      >
                        ◉<br />
                        Udhaar
                      </button>
                    </div>
                  </section>
                  <section
                    style={{
                      background: '#fff',
                      border: '1px solid #d9e6fb',
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>Shop Status</h3>
                    <div
                      style={{
                        fontSize: 22,
                        color: '#07965e',
                        fontWeight: 900,
                      }}
                    >
                      ✓ Shop Open
                    </div>
                    <p style={{ fontSize: 12, color: '#64748b' }}>
                      All systems working
                    </p>
                  </section>
                </div>
                <div style={styles.statsGrid}>
                  <div style={styles.statCard}>
                    <span>Total Products</span>
                    <strong>{products.length}</strong>
                  </div>
                  <div style={styles.statCard}>
                    <span>Total Sales Today</span>
                    <strong>{money(todaySales)}</strong>
                  </div>
                  <div style={styles.statCard}>
                    <span>Customers</span>
                    <strong>{customers.length}</strong>
                  </div>
                  <div style={styles.statCard}>
                    <span>Low Stock Items</span>
                    <strong>{lowStockProducts.length}</strong>
                  </div>
                </div>
                <div style={styles.box}>
                  <h3>Aaj ka Hisab</h3>
                  <p>
                    Daily Sale: <b>{money(todaySales)}</b>
                  </p>
                  <p>
                    Daily Gross Profit: <b>{money(todayProfit)}</b>
                  </p>
                  <p>
                    Daily Expenses: <b>{money(todayExpenses)}</b>
                  </p>
                  <p>
                    Net Profit after expenses:{' '}
                    <b
                      style={{
                        color:
                          todayProfit - todayExpenses >= 0 ? 'green' : 'red',
                      }}
                    >
                      {money(todayProfit - todayExpenses)}
                    </b>
                  </p>
                  <button style={styles.gray} onClick={openDailyReport}>
                    Daily Report Dekhein
                  </button>
                </div>
                <button style={styles.green} onClick={openProducts}>
                  Products
                </button>
                <button style={styles.gray} onClick={openBill}>
                  New Bill
                </button>
                <button style={styles.gray} onClick={openItemRequests}>
                  New Item Demand
                </button>
                <button style={styles.gray} onClick={openCustomers}>
                  Customers
                </button>
                <button style={styles.gray} onClick={openUdhar}>
                  Udhar Record
                </button>
                <button style={styles.gray} onClick={openStock}>
                  Stock
                </button>
                <button style={styles.gray} onClick={openProfitReports}>
                  Profit Reports
                </button>
                <button style={styles.gray} onClick={openExpenses}>
                  Expenses Record
                </button>
                <button
                  style={styles.gray}
                  onClick={exportBackup}
                  disabled={loading}
                >
                  {loading ? 'Please wait...' : 'Download Data Backup'}
                </button>
                <label style={styles.uploadLabel}>
                  Restore Backup (JSON)
                  <input
                    key={backupInputKey}
                    type="file"
                    accept=".json,application/json"
                    onChange={importBackup}
                    style={{ display: 'block', marginTop: 8 }}
                  />
                </label>
                <div style={styles.box}>
                  <h3>Low Stock Alert ({lowStockProducts.length})</h3>
                  {lowStockProducts.length === 0 ? (
                    <p>Sab products ka stock theek hai.</p>
                  ) : (
                    lowStockProducts.map((p) => (
                      <p key={p.id}>
                        <b>{p.name}</b> —{' '}
                        {p.stock <= 0 ? 'Out of Stock' : `Sirf ${p.stock} baqi`}
                      </p>
                    ))
                  )}
                </div>
                <div style={styles.box}>
                  <h3>Udhaar Payment Reminders</h3>
                  <button style={styles.green} onClick={loadDueReminders}>
                    Refresh Reminders
                  </button>
                  {dueReminders.length === 0 ? (
                    <p>Abhi koi overdue payment nahi hai.</p>
                  ) : (
                    dueReminders.map((bill) => (
                      <div key={bill.id} style={styles.product}>
                        <b>{bill.customer_name}</b>
                        <p>Mobile: {bill.phone || '-'}</p>
                        <p>Bill Number: {bill.id}</p>
                        <p>Due Date: {bill.due_date}</p>
                        <b style={{ color: 'red' }}>
                          Baqi Udhaar: {money(bill.balance)}
                        </b>
                        <p style={{ color: 'red' }}>Payment overdue hai!</p>
                        <button
                          style={styles.whatsapp}
                          onClick={() => sendWhatsAppForBill(bill)}
                        >
                          WhatsApp Reminder
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <p>{message}</p>
              </>
            )}

            {page !== 'dashboard' && (
              <button
                style={styles.gray}
                onClick={() => {
                  setPage('dashboard');
                  setMessage('');
                  setScannerOpen(false);
                }}
              >
                ← Back to Dashboard
              </button>
            )}

            {page === 'customers' && (
              <>
                <h3>Customers List</h3>
                <button style={styles.green} onClick={loadCustomers}>
                  Refresh Customers
                </button>
                <p>Total Customers: {customers.length}</p>
                {customers.length === 0 ? (
                  <p>Abhi koi customer nahi hai.</p>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} style={styles.product}>
                      <b>{c.name}</b>
                      <p>Mobile: {c.phone || '-'}</p>
                      <p>Customer ID: {c.id}</p>
                      <p>
                        Added:{' '}
                        {c.created_at
                          ? new Date(c.created_at).toLocaleDateString()
                          : '-'}
                      </p>
                    </div>
                  ))
                )}
                <p>{message}</p>
              </>
            )}

            {page === 'udhar' && (
              <>
                <h3>Udhar Record</h3>
                <button style={styles.green} onClick={loadUdharRecords}>
                  Refresh Udhar
                </button>
                {!udharBills.length ? (
                  <p>Kisi customer ka udhaar baqi nahi hai.</p>
                ) : (
                  udharBills.map((bill) => (
                    <div key={bill.id} style={styles.product}>
                      <b>{bill.customer_name}</b>
                      <p>Mobile: {bill.phone || '-'}</p>
                      <p>Bill Number: {bill.id}</p>
                      <p>Bill Total: {money(bill.total)}</p>
                      <p>Paid: {money(bill.paid)}</p>
                      <b style={{ color: 'red' }}>
                        Remaining: {money(bill.balance)}
                      </b>
                      <p>Due Date: {bill.due_date || '-'}</p>
                      <h4>Payment Jama Karein</h4>
                      <input
                        style={styles.input}
                        type="number"
                        min="0"
                        placeholder="Payment Amount"
                        value={paymentAmounts[bill.id] || ''}
                        onChange={(e) =>
                          setPaymentAmounts((old) => ({
                            ...old,
                            [bill.id]: e.target.value,
                          }))
                        }
                      />
                      <select
                        style={styles.input}
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option>Cash</option>
                        <option>Bank</option>
                        <option>JazzCash</option>
                        <option>EasyPaisa</option>
                      </select>
                      <button
                        style={styles.green}
                        disabled={loading}
                        onClick={() => saveUdharPayment(bill)}
                      >
                        {loading ? 'Saving...' : 'Save Payment'}
                      </button>
                      <button
                        style={styles.whatsapp}
                        onClick={() => whatsappReminder(bill)}
                      >
                        WhatsApp Reminder
                      </button>
                      {bill.payments.length > 0 && (
                        <>
                          <h4>Payment History</h4>
                          {bill.payments.map((p) => (
                            <p key={p.id}>
                              {money(p.amount)} — {p.payment_method || '-'}
                            </p>
                          ))}
                        </>
                      )}
                    </div>
                  ))
                )}
                <p>{message}</p>
              </>
            )}

            {page === 'stock' && (
              <>
                <h3>Stock Management</h3>
                <button style={styles.green} onClick={loadProducts}>
                  Refresh Stock
                </button>
                <p>Total Products: {products.length}</p>
                {products.map((p) => (
                  <div key={p.id} style={styles.product}>
                    <b>{p.name}</b>
                    <p>Stock Quantity: {p.stock}</p>
                    {Number(p.stock) <= 0 ? (
                      <b style={{ color: 'red' }}>Out of Stock</b>
                    ) : Number(p.stock) <= 5 ? (
                      <b style={{ color: '#d97706' }}>Low Stock Warning!</b>
                    ) : (
                      <b style={{ color: 'green' }}>Stock Available</b>
                    )}
                  </div>
                ))}
                <p>{message}</p>
              </>
            )}

            {(page === 'profits' || page === 'dailyReport') && (
              <>
                <h3>
                  {page === 'profits'
                    ? 'Profit Reports'
                    : 'Daily Sale and Profit Report'}
                </h3>
                <button
                  style={styles.green}
                  onClick={async () => {
                    await loadProfitReports();
                    await loadExpenses();
                  }}
                >
                  Refresh Reports
                </button>
                <div style={styles.box}>
                  <h3>
                    Total Sales:{' '}
                    {money(profitRows.reduce((s, r) => s + r.sale, 0))}
                  </h3>
                  <h3>
                    Purchase Cost:{' '}
                    {money(profitRows.reduce((s, r) => s + r.cost, 0))}
                  </h3>
                  <h2 style={{ color: 'green' }}>
                    Gross Profit:{' '}
                    {money(profitRows.reduce((s, r) => s + r.profit, 0))}
                  </h2>
                  <p>Today Sale: {money(todaySales)}</p>
                  <p>Today Gross Profit: {money(todayProfit)}</p>
                  <p>Today Expenses: {money(todayExpenses)}</p>
                  <b>Today Net Profit: {money(todayProfit - todayExpenses)}</b>
                </div>
                <h3>
                  {page === 'dailyReport' ? 'Aaj ke Bills' : 'Bill Wise Profit'}
                </h3>
                {(page === 'dailyReport'
                  ? profitRows.filter((r) => r.date === getToday())
                  : profitRows
                ).length === 0 ? (
                  <p>Is period mein sales record nahi hai.</p>
                ) : (
                  (page === 'dailyReport'
                    ? profitRows.filter((r) => r.date === getToday())
                    : profitRows
                  ).map((row) => (
                    <div key={row.order_id} style={styles.product}>
                      <b>Bill Number: {row.order_id}</b>
                      <p>Customer: {row.customer_name || '-'}</p>
                      <p>
                        Date:{' '}
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString()
                          : '-'}
                      </p>
                      <p>Sale: {money(row.sale)}</p>
                      <p>Purchase Cost: {money(row.cost)}</p>
                      <b style={{ color: 'green' }}>
                        Profit: {money(row.profit)}
                      </b>
                    </div>
                  ))
                )}
                <p>{message}</p>
              </>
            )}

            {page === 'expenses' && (
              <>
                <h3>Expenses Record</h3>
                <div style={styles.box}>
                  <input
                    style={styles.input}
                    placeholder="Expense ka naam (misal: Kiraya, Bijli)"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                  />
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    placeholder="Amount (PKR)"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                  <select
                    style={styles.input}
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                  >
                    <option>General</option>
                    <option>Rent</option>
                    <option>Electricity</option>
                    <option>Transport</option>
                    <option>Salary</option>
                    <option>Repair</option>
                    <option>Other</option>
                  </select>
                  <input
                    style={styles.input}
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                  <textarea
                    style={styles.input}
                    placeholder="Note (optional)"
                    value={expenseNote}
                    onChange={(e) => setExpenseNote(e.target.value)}
                  />
                  <button
                    style={styles.green}
                    disabled={loading}
                    onClick={saveExpense}
                  >
                    {loading ? 'Saving...' : 'Save Expense'}
                  </button>
                </div>
                <h3>Expense History</h3>
                <button style={styles.gray} onClick={loadExpenses}>
                  Refresh Expenses
                </button>
                <h3>
                  Total Expenses:{' '}
                  {money(
                    expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
                  )}
                </h3>
                {expenses.length === 0 ? (
                  <p>Abhi koi expense record nahi hai.</p>
                ) : (
                  expenses.map((e) => (
                    <div key={e.id} style={styles.product}>
                      <b>{e.title}</b>
                      <p>Amount: {money(e.amount)}</p>
                      <p>Category: {e.category || '-'}</p>
                      <p>Date: {e.expense_date || '-'}</p>
                      <p>Note: {e.note || '-'}</p>
                      <button
                        style={styles.red}
                        onClick={() => deleteExpense(e.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
                <p>{message}</p>
              </>
            )}

            {page === 'itemRequests' && (
              <>
                <h3>New Item Demand</h3>
                <div style={styles.box}>
                  <input
                    style={styles.input}
                    placeholder="Item ka naam likhein"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                  />
                  <button
                    style={styles.green}
                    onClick={saveItemRequest}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Item'}
                  </button>
                  <p>{message}</p>
                </div>
                <h3>Requested Items</h3>
                {!itemRequests.length ? (
                  <p>Abhi koi new item request nahi hai.</p>
                ) : (
                  itemRequests.map((item) => (
                    <div key={item.id} style={styles.product}>
                      <b>{item.item_name}</b>
                      <button
                        style={styles.red}
                        onClick={() => deleteItemRequest(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </>
            )}

            {page === 'products' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <h2 style={{ margin: 0 }}>⬡ Products</h2>
                  <button
                    style={styles.blue}
                    onClick={() => {
                      clearForm();
                      setShowProductForm(true);
                    }}
                  >
                    ＋ Add Product
                  </button>
                </div>
                <div
                  style={{
                    ...styles.statsGrid,
                    gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                  }}
                >
                  <div className="store-stat">
                    <span>Total Products</span>
                    <strong>{products.length}</strong>
                  </div>
                  <div
                    className="store-stat"
                    style={{
                      background: 'linear-gradient(135deg,#dcfce7,#fff)',
                    }}
                  >
                    <span>Total Stock Value</span>
                    <strong>
                      {money(
                        products.reduce(
                          (sum, p) =>
                            sum +
                            Number(p.buy_price || 0) * Number(p.stock || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                  <div
                    className="store-stat"
                    style={{
                      background: 'linear-gradient(135deg,#f1eaff,#fff)',
                    }}
                  >
                    <span>Best Selling Item</span>
                    <strong style={{ fontSize: 16 }}>
                      {profitRows.length ? 'Sales recorded' : '—'}
                    </strong>
                  </div>
                  <div
                    className="store-stat"
                    style={{
                      background: 'linear-gradient(135deg,#fff0df,#fff)',
                    }}
                  >
                    <span>Low Stock Items</span>
                    <strong>{lowStockProducts.length}</strong>
                  </div>
                </div>
                {showProductForm && (
                  <div style={styles.box}>
                    <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                    <input
                      style={styles.input}
                      placeholder="Product Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      placeholder="Buy Price (PKR)"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      placeholder="Stock Quantity"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="Barcode Number (optional)"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                    />
                    <select
                      style={styles.input}
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      style={styles.input}
                      placeholder="Description (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <label style={styles.uploadLabel}>
                      Product Picture (Camera / Gallery)
                      <input
                        style={{ ...styles.input, marginBottom: 4 }}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) =>
                          setProductImage(e.target.files?.[0] || null)
                        }
                      />
                      {productImage && <small>{productImage.name}</small>}
                    </label>
                    <button
                      style={styles.green}
                      onClick={saveProduct}
                      disabled={loading}
                    >
                      {loading
                        ? 'Saving...'
                        : editingId
                        ? 'Update Product'
                        : 'Save Product'}
                    </button>
                    {editingId && (
                      <button style={styles.gray} onClick={clearForm}>
                        Cancel Edit
                      </button>
                    )}
                    <p>{message}</p>
                    <button
                      style={styles.gray}
                      onClick={() => {
                        clearForm();
                        setShowProductForm(false);
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
                <div style={styles.sectionHeading}>
                  <h3 style={{ margin: 0 }}>All Products</h3>
                  <span>{products.length} items</span>
                </div>
                <input
                  style={styles.input}
                  placeholder="Search product name / barcode..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <select
                  style={styles.input}
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {!products.length && <p>Abhi koi product nahi hai.</p>}
                <div style={styles.productGrid}>
                  {products
                    .filter(
                      (p) =>
                        (p.name || '')
                          .toLowerCase()
                          .includes(productSearch.toLowerCase()) ||
                        String(p.barcode || '').includes(productSearch)
                    )
                    .filter(
                      (p) =>
                        productCategoryFilter === 'all' ||
                        String(p.category_id) === productCategoryFilter
                    )
                    .map((p) => (
                      <div key={p.id} style={styles.productCard}>
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            style={styles.productImage}
                          />
                        ) : (
                          <div style={styles.imagePlaceholder}>No Image</div>
                        )}
                        <div style={{ padding: 14, minWidth: 0 }}>
                          <b style={{ fontSize: 16 }}>{p.name}</b>
                          <p>
                            Category:{' '}
                            {categories.find(
                              (c) => String(c.id) === String(p.category_id)
                            )?.name || '-'}
                          </p>
                          <p>Buy Price: {money(p.buy_price)}</p>
                          <p>Stock: {p.stock}</p>
                          <p>Barcode: {p.barcode || '-'}</p>
                          {Number(p.stock) <= 0 ? (
                            <b style={{ color: 'red' }}>Out of Stock</b>
                          ) : Number(p.stock) <= 5 ? (
                            <b style={{ color: '#d97706' }}>
                              Low Stock Warning!
                            </b>
                          ) : null}
                          <br />
                          <button
                            style={styles.gray}
                            onClick={() => editProduct(p)}
                          >
                            Edit
                          </button>
                          <button
                            style={styles.red}
                            onClick={() => deleteProduct(p.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}

            {page === 'bill' && (
              <>
                <h3>New Customer Bill</h3>
                <div style={styles.box}>
                  <h3>Customer Details</h3>
                  <input
                    style={styles.input}
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <input
                    style={styles.input}
                    placeholder="Mobile Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <input
                    style={styles.input}
                    placeholder="Address (optional)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <h3>Udhaar Wapsi Ki Date</h3>
                  <button style={styles.gray} onClick={() => chooseDueDate(7)}>
                    7 Din
                  </button>
                  <button style={styles.gray} onClick={() => chooseDueDate(15)}>
                    15 Din
                  </button>
                  <button style={styles.gray} onClick={() => chooseDueDate(30)}>
                    30 Din
                  </button>
                  <input
                    style={styles.input}
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <p>
                    Selected Due Date: {dueDate || 'Abhi date select nahi hui'}
                  </p>
                </div>
                <div style={styles.box}>
                  <h3>Add Product to Bill</h3>
                  <input
                    style={styles.input}
                    placeholder="Barcode scan karein ya number likhein"
                    value={barcodeSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBarcodeSearch(value);
                      const found = products.find(
                        (p) => String(p.barcode || '') === value.trim()
                      );
                      if (found) addScannedOrSelectedProduct(found);
                    }}
                  />
                  <button
                    style={styles.gray}
                    onClick={() => setScannerOpen((v) => !v)}
                  >
                    {scannerOpen
                      ? 'Scanner Band Karein'
                      : 'Open Barcode Scanner'}
                  </button>
                  {scannerOpen && (
                    <div
                      id="barcode-reader"
                      style={{ width: '100%', marginTop: 10 }}
                    />
                  )}
                  <input
                    style={styles.input}
                    type="search"
                    placeholder="Product ka naam likhein... (misal: Sports)"
                    value={billProductSearch}
                    onChange={(e) => {
                      setBillProductSearch(e.target.value);
                      setSelectedProduct('');
                      setSellingPrice('');
                    }}
                  />
                  {billProductSearch.trim() && (
                    <div
                      style={{
                        maxHeight: 190,
                        overflowY: 'auto',
                        border: '1px solid #b8d4f5',
                        borderRadius: 10,
                        background: '#fff',
                        marginTop: 6,
                        marginBottom: 10,
                      }}
                    >
                      {products
                        .filter((p) =>
                          String(p.name || '')
                            .toLowerCase()
                            .includes(billProductSearch.trim().toLowerCase())
                        )
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            disabled={Number(p.stock) <= 0}
                            onClick={() => {
                              setSelectedProduct(String(p.id));
                              setSellingPrice(String(p.price || ''));
                              setBillProductSearch(p.name || '');
                              setMessage('Product select ho gaya: ' + p.name);
                            }}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              width: '100%',
                              padding: '10px 12px',
                              border: 0,
                              borderBottom: '1px solid #e5edf8',
                              background: '#fff',
                              color: Number(p.stock) <= 0 ? '#999' : '#082653',
                              textAlign: 'left',
                              cursor:
                                Number(p.stock) <= 0
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                          >
                            <span>{p.name}</span>
                            <span>
                              {Number(p.stock) <= 0
                                ? 'Out of Stock'
                                : `Stock: ${p.stock} · PKR ${p.price || 0}`}
                            </span>
                          </button>
                        ))}
                      {products.filter((p) =>
                        String(p.name || '')
                          .toLowerCase()
                          .includes(billProductSearch.trim().toLowerCase())
                      ).length === 0 && (
                        <p style={{ padding: 10, margin: 0, color: '#64748b' }}>
                          Is naam se koi product nahi mila.
                        </p>
                      )}
                    </div>
                  )}
                  {selectedProduct && (
                    <p
                      style={{
                        margin: '6px 0 10px',
                        color: '#087443',
                        fontWeight: 700,
                      }}
                    >
                      Selected:{' '}
                      {products.find(
                        (p) => String(p.id) === String(selectedProduct)
                      )?.name || ''}
                    </p>
                  )}
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    placeholder="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    placeholder="Selling Price per item (PKR)"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                  />
                  <button style={styles.green} onClick={addToCart}>
                    Add to Bill
                  </button>
                </div>
                <h3>Bill Items</h3>
                {cart.map((item, index) => (
                  <div style={styles.product} key={index}>
                    <b>{item.name}</b>
                    <p>Quantity: {item.quantity}</p>
                    <p>Selling Price: {money(item.price)}</p>
                    <p>Amount: {money(item.quantity * item.price)}</p>
                    <button
                      style={styles.red}
                      onClick={() => removeCartItem(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div style={styles.box}>
                  <h3>Total Bill: {money(billTotal)}</h3>
                  <label>Paid Amount (PKR)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                  <label>Payment Method</label>
                  <select
                    style={styles.input}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option>Cash</option>
                    <option>Bank</option>
                    <option>JazzCash</option>
                    <option>EasyPaisa</option>
                  </select>
                  <h3>Remaining Udhaar: {money(remaining)}</h3>
                  <button
                    style={styles.green}
                    onClick={saveBill}
                    disabled={loading || !cart.length}
                  >
                    {loading ? 'Saving Bill...' : 'Save Bill & Download PDF'}
                  </button>
                </div>
                <p>{message}</p>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

const styles = {
  appShell: {
    minHeight: '100vh',
    background: '#f3f6fb',
    color: '#172b4d',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  topHeader: {
    background: 'linear-gradient(120deg,#102b52,#174b83)',
    color: 'white',
    padding: '20px 26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
    boxShadow: '0 4px 16px rgba(15,35,65,.16)',
  },
  headerLogout: {
    background: '#ffffff',
    color: '#15365e',
    border: 0,
    borderRadius: 9,
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  appLayout: {
    display: 'grid',
    gridTemplateColumns: '230px minmax(0,1fr)',
    gap: 22,
    maxWidth: 1500,
    margin: '0 auto',
    padding: 22,
  },
  sidebar: {
    background: '#102b52',
    borderRadius: 16,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    alignSelf: 'start',
    position: 'sticky',
    top: 16,
  },
  sidebarCaption: {
    color: '#93b4da',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.4,
    padding: '13px 10px 5px',
  },
  navButton: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    color: '#e5efff',
    background: 'transparent',
    border: 0,
    borderRadius: 9,
    padding: '11px 12px',
    cursor: 'pointer',
    fontSize: 14,
    textDecoration: 'none',
  },
  navActive: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    color: '#102b52',
    background: '#ffffff',
    border: 0,
    borderRadius: 9,
    padding: '11px 12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 14,
  },
  mainContent: {
    minWidth: 0,
    background: '#ffffff',
    borderRadius: 16,
    padding: 22,
    boxShadow: '0 4px 22px rgba(15,35,65,.06)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))',
    gap: 13,
    margin: '15px 0 22px',
  },
  statCard: {
    background: '#f1f6ff',
    border: '1px solid #dce8f8',
    borderRadius: 13,
    padding: 17,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '22px 0 12px',
    color: '#15365e',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(165px,1fr))',
    gap: 12,
  },
  productCard: {
    border: '1px solid #e1e9f4',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 3px 12px rgba(20,45,80,.05)',
  },
  productImage: {
    width: '100%',
    height: 125,
    objectFit: 'contain',
    display: 'block',
    background: '#f3f6fb',
    padding: 8,
  },
  imagePlaceholder: {
    height: 155,
    display: 'grid',
    placeItems: 'center',
    color: '#8294aa',
    background: '#edf2f8',
    fontWeight: 700,
  },
  center: { textAlign: 'center', padding: '30px' },
  container: {
    padding: '15px',
    maxWidth: '700px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  box: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '15px',
    margin: '15px 0',
  },
  product: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '12px',
    margin: '10px 0',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '10px',
    margin: '10px 0',
    boxSizing: 'border-box',
  },
  blue: {
    background: '#1769ed',
    color: '#fff',
    padding: '12px 14px',
    border: 'none',
    cursor: 'pointer',
    margin: '5px',
    borderRadius: '8px',
  },
  green: {
    background: 'green',
    color: 'white',
    padding: '12px',
    border: 'none',
    cursor: 'pointer',
    margin: '5px',
    borderRadius: '5px',
  },
  red: {
    background: 'red',
    color: 'white',
    padding: '10px',
    border: 'none',
    cursor: 'pointer',
    margin: '5px',
    borderRadius: '5px',
  },
  gray: {
    background: '#ddd',
    color: '#000',
    padding: '10px',
    margin: '5px',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '5px',
  },
  whatsapp: {
    background: '#168b45',
    color: 'white',
    padding: '10px',
    margin: '5px',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '5px',
  },
  uploadLabel: {
    display: 'block',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '12px',
    margin: '10px 5px',
  },
};
