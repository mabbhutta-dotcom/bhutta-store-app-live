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
  const [topSelling, setTopSelling] = useState([]);
  const [savedBills, setSavedBills] = useState([]);
  const [selectedSavedBill, setSelectedSavedBill] = useState(null);
  const [returnBillNumber, setReturnBillNumber] = useState('');
  const [returnBill, setReturnBill] = useState(null);
  const [returnableItems, setReturnableItems] = useState([]);
  const [returnItems, setReturnItems] = useState([]);
  const [returnMethod, setReturnMethod] = useState('cash');
  const [returnPeriod, setReturnPeriod] = useState('month');
  const [returnRows, setReturnRows] = useState([]);
  const [returnSelections, setReturnSelections] = useState({});
  const [billProductSearch, setBillProductSearch] = useState('');
  const [billProductSelections, setBillProductSelections] = useState({});

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [name, setName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [productImage, setProductImage] = useState(null);
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

  const salesSubtotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
  const returnTotal = returnItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const billTotal = salesSubtotal - returnTotal;
  const payableTotal = Math.max(0, billTotal);
  const extraRefund = Math.max(0, -billTotal);
  const remaining = payableTotal - Number(paidAmount || 0);
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
    await Promise.all([loadCategories(), loadProducts(), loadTopSelling()]);
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
    let imageUrl = editingId ? products.find((p) => String(p.id) === String(editingId))?.image_url || null : null;
    if (productImage) {
      const extension = (productImage.name.split('.').pop() || 'jpg').toLowerCase();
      const filePath = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, productImage, { upsert: true, contentType: productImage.type || 'image/jpeg' });
      if (uploadError) { setLoading(false); return setMessage('Picture upload nahi hui: ' + uploadError.message); }
      imageUrl = supabase.storage.from('product-images').getPublicUrl(filePath).data.publicUrl;
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
    await loadProducts();
    setMessage('Product save ho gaya!');
  };

  const editProduct = (p) => {
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

  const loadTopSelling = async () => {
    const [{ data, error }, { data: returns, error: returnError }] = await Promise.all([
      supabase.from('order_items').select('product_id, quantity, products(name)'),
      supabase.from('order_returns').select('product_id, quantity'),
    ]);
    if (error) return setMessage('Top selling report error: ' + error.message);
    if (returnError) return setMessage('Top selling returns error: ' + returnError.message);
    const returned = {};
    (returns || []).forEach((r) => { returned[r.product_id] = (returned[r.product_id] || 0) + Number(r.quantity || 0); });
    const totals = {};
    (data || []).forEach((row) => {
      const id = row.product_id;
      if (!id) return;
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      if (!totals[id]) totals[id] = { product_id: id, name: product?.name || 'Deleted Product', quantity: 0 };
      totals[id].quantity += Number(row.quantity || 0);
    });
    Object.values(totals).forEach((item) => { item.quantity = Math.max(0, item.quantity - Number(returned[item.product_id] || 0)); });
    setTopSelling(Object.values(totals).filter((item) => item.quantity > 0).sort((a, b) => b.quantity - a.quantity).slice(0, 5));
  };

  const loadSavedBills = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return setMessage('Saved bills load nahi huay: ' + error.message);
    setSavedBills(data || []);
  };

  const openSavedBills = async () => {
    setPage('savedBills');
    setSelectedSavedBill(null);
    setMessage('');
    await loadSavedBills();
  };

  const openReturnReports = async () => {
    setPage('returnReports');
    setMessage('');
    await loadReturnReports();
  };

  const loadReturnReports = async () => {
    const { data, error } = await supabase.from('order_returns').select('*, customers(name)').order('created_at', { ascending: false });
    if (error) return setMessage('Return report load nahi hui: ' + error.message);
    setReturnRows(data || []);
  };

  const searchOldBillForReturn = async () => {
    const id = Number(returnBillNumber);
    if (!Number.isInteger(id) || id <= 0) return setMessage('Purane bill ka sahi number likhein.');
    setLoading(true);
    const { data: oldBill, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    if (error || !oldBill) { setLoading(false); return setMessage(error?.message || 'Is number ka bill nahi mila.'); }
    const { data: oldItems, error: itemError } = await supabase.from('order_items').select('*').eq('order_id', id);
    if (itemError) { setLoading(false); return setMessage(itemError.message); }
    const { data: priorReturns, error: returnError } = await supabase.from('order_returns').select('product_id, quantity').eq('order_id', id);
    if (returnError) { setLoading(false); return setMessage(returnError.message); }
    const items = (oldItems || []).map((item) => {
      const product = products.find((p) => String(p.id) === String(item.product_id));
      const alreadyReturned = (priorReturns || []).filter((r) => String(r.product_id) === String(item.product_id)).reduce((n, r) => n + Number(r.quantity || 0), 0);
      return { product_id: item.product_id, name: product?.name || 'Product #' + item.product_id, original_quantity: Number(item.quantity), returned_quantity: alreadyReturned, available_quantity: Math.max(0, Number(item.quantity) - alreadyReturned), price: Number(item.price || 0) };
    }).filter((item) => item.available_quantity > 0);
    setReturnBill(oldBill);
    setReturnItems([]);
    setReturnSelections({});
    if (!customerName.trim()) setCustomerName(oldBill.customer_name || '');
    if (!phone.trim()) setPhone(oldBill.phone || '');
    setReturnableItems(items);
    setLoading(false);
    setMessage(items.length ? 'Purana bill mil gaya. Wapas hone wali item select karein.' : 'Is bill ki tamam items pehle hi return ho chuki hain.');
  };

  const addReturnItem = (productId, qtyValue) => {
    const item = returnableItems.find((x) => String(x.product_id) === String(productId));
    const qty = Number(qtyValue);
    if (!item || !Number.isInteger(qty) || qty <= 0 || qty > item.available_quantity) return setMessage('Return quantity available quantity se zyada nahi ho sakti.');
    setReturnItems((old) => {
      const exists = old.find((x) => String(x.product_id) === String(productId) && String(x.old_order_id) === String(returnBill.id));
      if (exists) return old.map((x) => x === exists ? { ...x, quantity: qty } : x);
      return [...old, { old_order_id: returnBill.id, product_id: item.product_id, name: item.name, quantity: qty, price: item.price, customer_id: returnBill.customer_id || null }];
    });
    setMessage('Return item new bill mein add ho gayi.');
  };

  const applySelectedReturns = () => {
    if (!returnBill) return setMessage('Pehle purana bill search karein.');
    const selected = returnableItems.filter((item) => returnSelections[item.product_id]?.checked);
    if (!selected.length) return setMessage('Return ke liye kam az kam aik item select karein.');
    const prepared = [];
    for (const item of selected) {
      const qty = Number(returnSelections[item.product_id]?.quantity || 1);
      if (!Number.isInteger(qty) || qty <= 0 || qty > item.available_quantity)
        return setMessage(`${item.name}: return quantity 1 se ${item.available_quantity} ke darmiyan honi chahiye.`);
      prepared.push({ old_order_id: returnBill.id, product_id: item.product_id, name: item.name, quantity: qty, price: item.price, customer_id: returnBill.customer_id || null });
    }
    setReturnItems((old) => {
      const otherBills = old.filter((x) => String(x.old_order_id) !== String(returnBill.id));
      return [...otherBills, ...prepared];
    });
    setMessage(`${prepared.length} return item(s) new bill mein add ho gayi hain.`);
  };

  const addSelectedProductsToCart = () => {
    const selected = products.filter((p) => billProductSelections[p.id]?.checked);
    if (!selected.length) return setMessage('Bill ke liye kam az kam aik product select karein.');
    const additions = [];
    for (const product of selected) {
      const selection = billProductSelections[product.id] || {};
      const qty = Number(selection.quantity || 1);
      const priceText = selection.price === undefined ? String(product.price || '') : String(selection.price);
      const price = Number(priceText);
      const already = cart.filter((i) => String(i.product_id) === String(product.id)).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
      if (!Number.isInteger(qty) || qty <= 0 || priceText === '' || !Number.isFinite(price) || price < 0)
        return setMessage(`${product.name}: quantity aur selling price theek likhein.`);
      if (already + qty > Number(product.stock || 0))
        return setMessage(`${product.name}: itna stock available nahi. Available stock: ${Math.max(0, Number(product.stock || 0) - already)}`);
      additions.push({ product_id: product.id, name: product.name, quantity: qty, price, buy_price: Number(product.buy_price || 0) });
    }
    setCart((old) => {
      const next = [...old];
      additions.forEach((add) => {
        const index = next.findIndex((item) => String(item.product_id) === String(add.product_id));
        if (index >= 0) next[index] = { ...next[index], quantity: next[index].quantity + add.quantity, price: add.price };
        else next.push(add);
      });
      return next;
    });
    setBillProductSelections({});
    setBillProductSearch('');
    setMessage(`${additions.length} product(s) bill mein add ho gaye.`);
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
    setReturnItems([]);
    setReturnBill(null);
    setReturnableItems([]);
    setReturnBillNumber('');
    setReturnMethod('cash');
    setCustomerName('');
    setPhone('');
    setAddress('');
    setPaidAmount('0');
    setDueDate('');
    setSelectedProduct('');
    setSellingPrice('');
    setQuantity('1');
    setBarcodeSearch('');
    setReturnSelections({});
    setBillProductSearch('');
    setBillProductSelections({});
    setReturnItems([]);
    setReturnBill(null);
    setReturnableItems([]);
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

 
const downloadBillPdf = (bill, items, paid, due, returns = []) => {
  const doc = new jsPDF();
  const pageWidth = 210;
  const navy = [15, 39, 71];
  const blue = [220, 235, 250];
  const margin = 14;
  let y = 15;

  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity) * Number(item.price),
    0
  );

  const returnDeduction = returns.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);

  const discount = Number(
    bill.discount ?? bill.discount_amount ?? 0
  );

  const grandTotal = Number(
    bill.total ?? subtotal - discount
  );

  const paidAmount = Number(paid || 0);
  const remaining = grandTotal - paidAmount;

  const money = (amount) =>
    `Rs. ${Number(amount).toFixed(2)}`;

  const drawHeader = () => {
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 49, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(19);
    doc.setFont('helvetica', 'bold');
    doc.text('Bhutta Shoes & Plastic Store', 105, 12, {
      align: 'center'
    });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    doc.text('Muhammad Rashid Bhutta', 14, 25);
    doc.text('Mobile: 03017623456', 14, 32);

    doc.setFont('helvetica', 'bold');
    doc.text('OWNER', 196, 23, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Muhammad Asif Bhutta', 196, 31, {
      align: 'right'
    });
    doc.text('Muhammad Sajid Bhutta', 196, 38, {
      align: 'right'
    });

    doc.setTextColor(0, 0, 0);
    y = 58;
  };

  const drawTableHeader = () => {
    doc.setFillColor(...navy);
    doc.rect(margin, y, 182, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    doc.text('Item Name', 17, y + 7);
    doc.text('Qty', 112, y + 7);
    doc.text('Rate', 140, y + 7);
    doc.text('Total', 190, y + 7, {
      align: 'right'
    });

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 16;
  };

  const newPage = () => {
    doc.addPage();
    drawHeader();
    drawTableHeader();
  };

  drawHeader();

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('SALES INVOICE', 105, y, {
    align: 'center'
  });

  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.text(`Bill Number: ${bill.id}`, 14, y);
  doc.text(
    `Date: ${new Date().toLocaleDateString()}`,
    196,
    y,
    { align: 'right' }
  );

  y += 8;

  doc.text(
    `Customer: ${bill.customer_name || '-'}`,
    14,
    y
  );

  doc.text(
    `Mobile: ${bill.phone || '-'}`,
    196,
    y,
    { align: 'right' }
  );

  y += 10;

  drawTableHeader();

  items.forEach((item) => {
    const itemName = doc.splitTextToSize(
      String(item.name || '-'),
      85
    );

    const rowHeight = Math.max(9, itemName.length * 5 + 3);

    if (y + rowHeight > 255) {
      newPage();
    }

    doc.setFontSize(9);
    doc.text(itemName, 17, y);

    doc.text(String(item.quantity), 112, y);

    doc.text(
      Number(item.price).toFixed(2),
      140,
      y
    );

    doc.text(
      (Number(item.quantity) * Number(item.price)).toFixed(2),
      190,
      y,
      { align: 'right' }
    );

    y += rowHeight;

    doc.setDrawColor(220, 225, 235);
    doc.line(14, y - 2, 196, y - 2);
  });

  if (returns.length) {
    y += 4;
    if (y + 12 > 255) newPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(170, 45, 45);
    doc.text('RETURNED ITEMS', 14, y + 4);
    y += 10;
    returns.forEach((item) => {
      if (y + 9 > 255) newPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(item.name || 'Returned item'), 17, y);
      doc.text(String(item.quantity), 112, y);
      doc.text(Number(item.price).toFixed(2), 140, y);
      doc.text((Number(item.quantity) * Number(item.price)).toFixed(2), 190, y, { align: 'right' });
      y += 8;
    });
    doc.setTextColor(0, 0, 0);
  }

  if (y + 95 > 275) {
    newPage();
  }

  y += 7;

  doc.setFillColor(...blue);
  doc.roundedRect(105, y, 91, 68, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.text('Subtotal:', 112, y + 9);
  doc.text(money(subtotal), 190, y + 9, {
    align: 'right'
  });

  doc.text('Return Deduction:', 112, y + 18);
  doc.text(money(returnDeduction), 190, y + 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Net Total:', 112, y + 29);
  doc.text(money(grandTotal), 190, y + 29, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Paid:', 112, y + 38);
  doc.text(money(paidAmount), 190, y + 38, { align: 'right' });
  doc.text('Balance:', 112, y + 48);
  doc.text(money(remaining), 190, y + 48, { align: 'right' });
  if (Number(bill.refund_amount || 0) > 0) {
    doc.text('Extra Refund:', 112, y + 58);
    doc.text(money(bill.refund_amount), 190, y + 58, { align: 'right' });
  }

  y += 75;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Remaining: ${money(remaining)}`, 112, y);

  y += 9;

  if (due) {
    doc.setFontSize(10);
    doc.text(`Due Date: ${due}`, 112, y);
    y += 10;
  }

  y = Math.max(y + 25, 250);

  doc.setDrawColor(...navy);
  doc.line(18, y, 82, y);
  doc.line(128, y, 192, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text('Customer Signature', 50, y + 6, {
    align: 'center'
  });

  doc.text('Authorized Signature', 160, y + 6, {
    align: 'center'
  });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);

  doc.text(
    'Thank You For Shopping With Us!',
    105,
    282,
    { align: 'center' }
  );

  doc.save(`Bill-${bill.id}.pdf`);
};

  const saveBill = async () => {
    if (!customerName.trim()) return setMessage('Customer ka naam likhein.');
    if (!cart.length && !returnItems.length) return setMessage('Bill mein sale ya return item zaroor honi chahiye.');
    const paid = Number(paidAmount || 0);
    if (!Number.isFinite(paid) || paid < 0 || paid > payableTotal)
      return setMessage('Paid amount payable total se zyada ya negative nahi ho sakta.');
    if (payableTotal > paid && !dueDate) return setMessage('Udhaar ki wapsi ki date select karein.');
    if (returnItems.length && !returnBill) return setMessage('Return ke liye purana bill search karein.');
    if (extraRefund > 0 && !['cash', 'credit'].includes(returnMethod)) return setMessage('Refund ka tareeqa select karein.');

    setLoading(true);
    setMessage('');
    const stockBefore = [];
    for (const item of cart) {
      const { data: p, error } = await supabase.from('products').select('id, stock').eq('id', item.product_id).single();
      if (error || !p || Number(p.stock) < item.quantity) {
        setLoading(false);
        return setMessage(error?.message || `${item.name} ka stock ab ${p?.stock ?? 0} hai. Bill dobara check karein.`);
      }
      stockBefore.push({ id: p.id, stock: Number(p.stock), quantity: item.quantity, name: item.name });
    }

    let customerId = null;
    if (phone.trim()) {
      const { data: oldCustomer, error: findError } = await supabase.from('customers').select('id').eq('phone', phone.trim()).maybeSingle();
      if (findError) { setLoading(false); return setMessage(findError.message); }
      if (oldCustomer) {
        customerId = oldCustomer.id;
        const { error: customerUpdateError } = await supabase.from('customers').update({ name: customerName.trim() }).eq('id', customerId);
        if (customerUpdateError) { setLoading(false); return setMessage(customerUpdateError.message); }
      }
    }
    if (!customerId) {
      const { data: newCustomer, error } = await supabase.from('customers').insert([{ name: customerName.trim(), phone: phone.trim() || null }]).select('id').single();
      if (error) { setLoading(false); return setMessage(error.message); }
      customerId = newCustomer.id;
    }

    // Purane bill ka customer aur naya bill wala customer aik hi hona chahiye.
    if (returnItems.length && returnBill?.customer_id && String(returnBill.customer_id) !== String(customerId)) {
      setLoading(false);
      return setMessage('Return wala purana bill isi customer ka hona chahiye. Customer ka mobile number/name check karein.');
    }

    let creditRows = [];
    let creditApplied = 0;
    if (payableTotal > 0) {
      const { data: credits, error: creditError } = await supabase.from('customer_credits').select('*').eq('customer_id', customerId).gt('remaining_amount', 0).order('created_at', { ascending: true });
      if (creditError) { setLoading(false); return setMessage('Customer credit check nahi ho saka: ' + creditError.message); }
      let remainingToApply = payableTotal;
      for (const credit of credits || []) {
        if (remainingToApply <= 0) break;
        const use = Math.min(Number(credit.remaining_amount || 0), remainingToApply);
        if (use > 0) { creditRows.push({ id: credit.id, old: Number(credit.remaining_amount), use }); creditApplied += use; remainingToApply -= use; }
      }
    }
    const finalPayable = Math.max(0, payableTotal - creditApplied);
    if (paid > finalPayable) { setLoading(false); return setMessage(`Customer credit ${money(creditApplied)} adjust hone ke baad paid amount ${money(finalPayable)} se zyada nahi ho sakti.`); }
    if (finalPayable > paid && !dueDate) { setLoading(false); return setMessage('Baqi udhaar ki wapsi ki date select karein.'); }

    const status = paid === finalPayable ? 'paid' : paid > 0 ? 'partial' : 'udhaar';
    const { data: order, error: orderError } = await supabase.from('orders').insert([{
      customer_name: customerName.trim(), phone: phone.trim(), address: address.trim(),
      total: finalPayable, status, customer_id: customerId, due_date: finalPayable > paid ? dueDate : null,
    }]).select('id').single();
    if (orderError) { setLoading(false); return setMessage(orderError.message); }

    const insertedItems = [];
    for (const item of cart) {
      const { data, error } = await supabase.from('order_items').insert([{
        order_id: order.id, product_id: item.product_id, quantity: item.quantity, price: item.price, buy_price: item.buy_price,
      }]).select('id').single();
      if (error) {
        for (const saved of insertedItems) await supabase.from('order_items').delete().eq('id', saved.id);
        await supabase.from('orders').delete().eq('id', order.id);
        setLoading(false); return setMessage(error.message);
      }
      insertedItems.push(data);
    }

    if (paid > 0) {
      const { error } = await supabase.from('payments').insert([{ customer_id: customerId, order_id: order.id, amount: paid, payment_method: paymentMethod, note: 'Bill payment' }]);
      if (error) { for (const saved of insertedItems) await supabase.from('order_items').delete().eq('id', saved.id); await supabase.from('orders').delete().eq('id', order.id); setLoading(false); return setMessage('Payment save nahi hui: ' + error.message); }
    }

    // Apply previously deposited customer credit.
    for (const credit of creditRows) {
      const { error } = await supabase.from('customer_credits').update({ remaining_amount: credit.old - credit.use }).eq('id', credit.id);
      if (error) { setLoading(false); return setMessage('Bill save ho gaya lekin customer credit adjust nahi hua: ' + error.message); }
    }

    // Update stock for sold and returned items.
    const stockChanges = [];
    for (const old of stockBefore) {
      const { error } = await supabase.from('products').update({ stock: old.stock - old.quantity }).eq('id', old.id);
      if (error) { setLoading(false); return setMessage('Bill save ho gaya lekin sale stock update mein error: ' + error.message); }
      stockChanges.push({ id: old.id, before: old.stock });
    }
    for (const ret of returnItems) {
      const product = products.find((p) => String(p.id) === String(ret.product_id));
      if (!product) continue;
      const { data: current, error: currentError } = await supabase.from('products').select('stock').eq('id', ret.product_id).single();
      if (currentError) { setLoading(false); return setMessage('Return stock check error: ' + currentError.message); }
      const { error } = await supabase.from('products').update({ stock: Number(current.stock || 0) + ret.quantity }).eq('id', ret.product_id);
      if (error) { setLoading(false); return setMessage('Return stock update error: ' + error.message); }
    }

    const savedReturnIds = [];
    for (const ret of returnItems) {
      const { data: savedReturn, error } = await supabase.from('order_returns').insert([{
        order_id: ret.old_order_id, new_bill_id: order.id, customer_id: customerId,
        product_id: ret.product_id, product_name: ret.name, quantity: ret.quantity,
        price: ret.price, refund_method: extraRefund > 0 ? returnMethod : 'adjusted_in_bill',
      }]).select('id').single();
      if (error) { setLoading(false); return setMessage('Bill save ho gaya lekin return record save nahi hua: ' + error.message); }
      savedReturnIds.push(savedReturn.id);
    }

    if (extraRefund > 0 && returnMethod === 'credit') {
      const { error } = await supabase.from('customer_credits').insert([{
        customer_id: customerId, amount: extraRefund, remaining_amount: extraRefund,
        source_return_id: savedReturnIds[0] || null,
      }]);
      if (error) { setLoading(false); return setMessage('Return save ho gaya lekin customer credit save nahi hua: ' + error.message); }
    }

    const billInfo = { id: order.id, customer_name: customerName.trim(), phone: phone.trim(), total: finalPayable, refund_amount: extraRefund, refund_method: returnMethod, credit_applied: creditApplied };
    downloadBillPdf(billInfo, [...cart], paid, finalPayable > paid ? dueDate : '', [...returnItems]);
    setLoading(false);
    await Promise.all([loadProducts(), loadDueReminders(), loadProfitReports(), loadTopSelling(), loadReturnReports()]);
    setCart([]); setReturnItems([]); setReturnBill(null); setReturnableItems([]); setReturnBillNumber(''); setReturnSelections({}); setBillProductSelections({}); setBillProductSearch('');
    setCustomerName(''); setPhone(''); setAddress(''); setPaidAmount('0'); setDueDate('');
    setMessage(`Bill successfully save ho gaya! Bill number: ${order.id}. Return: ${money(returnTotal)}. ${creditApplied > 0 ? `Customer credit adjust: ${money(creditApplied)}. ` : ''}${extraRefund > 0 ? (returnMethod === 'cash' ? `Cash refund: ${money(extraRefund)}.` : `Customer ke udhar/account mein jama: ${money(extraRefund)}.`) : ''} PDF download shuru ho gaya.`);
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
      'order_returns',
      'customer_credits',
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
        'order_returns',
        'customer_credits',
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
         <p style={{ textAlign: 'center', color: '#168B65', fontWeight: '600' }}>
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
      <header style={styles.topHeader}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff' }}>Bhutta Shoes & Plastic Store</h2>
          <p style={{ margin: '5px 0 0', color: '#bfdbfe', fontSize: 13 }}>Created by Muhammad Rashid Bhutta</p>
        </div>
        <button style={styles.headerLogout} onClick={logout}>Logout</button>
      </header>
      <div style={styles.appLayout}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarCaption}>STORE MENU</div>
          {[
            ['dashboard', 'Dashboard'], ['bill', 'New Bill'], ['products', 'Products'],
            ['customers', 'Customers'], ['udhar', 'Udhaar'], ['stock', 'Stock'],
            ['profits', 'Reports'], ['savedBills', 'Saved Bills'], ['returnReports', 'Return Reports'], ['expenses', 'Expenses'], ['itemRequests', 'Item Requests']
          ].map(([key, label]) => (
            <button key={key} style={page === key ? styles.navActive : styles.navButton} onClick={() => { setPage(key); setMessage(''); if (key === 'products') openProducts(); if (key === 'customers') openCustomers(); if (key === 'udhar') openUdhar(); if (key === 'stock') openStock(); if (key === 'expenses') openExpenses(); if (key === 'itemRequests') openItemRequests(); if (key === 'profits') openProfitReports(); if (key === 'savedBills') openSavedBills(); if (key === 'returnReports') openReturnReports(); if (key === 'bill') openBill(); }}>
              {label}
            </button>
          ))}
          <div style={styles.sidebarCaption}>DATA</div>
          <button style={styles.navButton} onClick={exportBackup} disabled={loading}>Download Backup</button>
          <label style={styles.navButton}>Restore Backup<input key={backupInputKey} type="file" accept=".json,application/json" onChange={importBackup} style={{display:'none'}} /></label>
        </aside>
        <main style={styles.mainContent}>
          {page === 'dashboard' && (
        <>
          <h3>Owner Dashboard</h3>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}><span>Total Products</span><strong>{products.length}</strong></div>
            <div style={styles.statCard}><span>Total Sales Today</span><strong>{money(todaySales)}</strong></div>
            <div style={styles.statCard}><span>Customers</span><strong>{customers.length}</strong></div>
            <div style={styles.statCard}><span>Low Stock Items</span><strong>{lowStockProducts.length}</strong></div>
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
                  color: todayProfit - todayExpenses >= 0 ? 'green' : 'red',
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
          <button style={styles.gray} onClick={exportBackup} disabled={loading}>
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
                <b style={{ color: 'red' }}>Remaining: {money(bill.balance)}</b>
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
              Total Sales: {money(profitRows.reduce((s, r) => s + r.sale, 0))}
            </h3>
            <h3>
              Purchase Cost: {money(profitRows.reduce((s, r) => s + r.cost, 0))}
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
                <b style={{ color: 'green' }}>Profit: {money(row.profit)}</b>
              </div>
            ))
          )}
          <p>{message}</p>
        </>
      )}

      {page === 'savedBills' && (
        <>
          <h3>Saved Bills</h3>
          <button style={styles.green} onClick={loadSavedBills}>Refresh Bills</button>
          {selectedSavedBill ? <div style={styles.box}>
            <button style={styles.gray} onClick={() => setSelectedSavedBill(null)}>Back to Bills</button>
            <h3>Bill #{selectedSavedBill.id}</h3><p>Customer: {selectedSavedBill.customer_name || '-'}</p><p>Mobile: {selectedSavedBill.phone || '-'}</p><p>Date: {new Date(selectedSavedBill.created_at).toLocaleString()}</p>
            {(selectedSavedBill.items || []).map((item, i) => <p key={i}>{item.name || `Product #${item.product_id}`} — {item.quantity} x {money(item.price)} = {money(item.quantity * item.price)}</p>)}
            <h3>Total: {money(selectedSavedBill.total)}</h3>
          </div> : savedBills.map((bill) => <div key={bill.id} style={styles.product}><b>Bill #{bill.id}</b><p>{bill.customer_name || '-'} | {bill.phone || '-'}</p><p>{new Date(bill.created_at).toLocaleString()}</p><b>{money(bill.total)}</b><br/><button style={styles.green} onClick={async () => { const { data, error } = await supabase.from('order_items').select('*').eq('order_id', bill.id); if (error) return setMessage(error.message); const items = await Promise.all((data || []).map(async (it) => { const p = products.find((x) => String(x.id) === String(it.product_id)); return { ...it, name: p?.name || `Product #${it.product_id}` }; })); setSelectedSavedBill({ ...bill, items }); }}>View Bill</button></div>)}
          <p>{message}</p>
        </>
      )}

      {page === 'returnReports' && (
        <>
          <h3>Product Return Reports</h3>
          <button style={styles.green} onClick={loadReturnReports}>Refresh Returns</button>
          <select style={styles.input} value={returnPeriod} onChange={(e) => setReturnPeriod(e.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option><option value="all">All Records</option></select>
          {(() => { const now = new Date(); const rows = returnRows.filter((r) => { const d = new Date(r.created_at); if (returnPeriod === 'all') return true; if (returnPeriod === 'day') return d.toDateString() === now.toDateString(); if (returnPeriod === 'week') { const start = new Date(now); start.setDate(now.getDate() - 7); return d >= start; } if (returnPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); return d.getFullYear() === now.getFullYear(); }); return <><div style={styles.box}><h3>Total Returned: {rows.reduce((s, r) => s + Number(r.quantity || 0), 0)} items</h3><h3>Return Amount: {money(rows.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.price || 0), 0))}</h3></div>{rows.map((r) => <div key={r.id} style={styles.product}><b>{r.product_name}</b><p>Old Bill: #{r.order_id} | New Bill: #{r.new_bill_id || '-'}</p><p>Customer: {r.customers?.name || (r.customer_id ? `Customer #${r.customer_id}` : '-')}</p><p>Quantity: {r.quantity} | Amount: {money(Number(r.quantity) * Number(r.price))}</p><p>Date: {new Date(r.created_at).toLocaleString()}</p><p>Refund: {r.refund_method || '-'}</p></div>)}</>; })()}
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
            {money(expenses.reduce((s, e) => s + Number(e.amount || 0), 0))}
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
                <button style={styles.red} onClick={() => deleteExpense(e.id)}>
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
          <h3>Products Management</h3>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}><span>Total Products</span><strong>{products.length}</strong></div>
            <div style={styles.statCard}><span>Total Stock Value</span><strong>{money(products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.buy_price || 0), 0))}</strong></div>
            <div style={styles.statCard}><span>Best Selling Item</span><strong>{topSelling[0]?.name || 'Abhi sale nahi'}</strong></div>
            <div style={styles.statCard}><span>Low Stock Items</span><strong>{lowStockProducts.length}</strong></div>
          </div>
          <div style={styles.box}>
            <div style={styles.sectionHeading}><h3 style={{margin:0}}>Top Selling Products</h3><button style={styles.gray} onClick={loadTopSelling}>Refresh</button></div>
            {topSelling.length ? topSelling.map((item) => <p key={item.product_id}><b>{item.name}</b> — {item.quantity} sold</p>) : <p>Abhi sales record mojood nahi.</p>}
          </div>
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
            <label style={styles.uploadLabel}>Product Picture (Camera / Gallery)
              <input style={{...styles.input, marginBottom: 4}} type="file" accept="image/*" capture="environment" onChange={(e) => setProductImage(e.target.files?.[0] || null)} />
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
          </div>
          <div style={styles.sectionHeading}><h3 style={{margin:0}}>All Products</h3><span>{products.length} items</span></div>
          <input style={styles.input} placeholder="Search product name / barcode..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
          <select style={styles.input} value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)}><option value="all">All Categories</option>{categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}</select>
          {!products.length && <p>Abhi koi product nahi hai.</p>}
          <div style={styles.productGrid}>
          {products.filter(p => (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) || String(p.barcode || '').includes(productSearch)).filter(p => productCategoryFilter === 'all' || String(p.category_id) === productCategoryFilter).map((p) => (
            <div key={p.id} style={styles.productCard}>
              {p.image_url ? <img src={p.image_url} alt={p.name} style={styles.productImage} /> : <div style={styles.imagePlaceholder}>No Image</div>}
              <div style={{padding:14, minWidth:0}}>
              <b style={{fontSize:16}}>{p.name}</b>
              <p>
                Category:{' '}
                {categories.find((c) => String(c.id) === String(p.category_id))
                  ?.name || '-'}
              </p>
              <p>Buy Price: {money(p.buy_price)}</p>
              <p>Stock: {p.stock}</p>
              <p>Barcode: {p.barcode || '-'}</p>
              {Number(p.stock) <= 0 ? (
                <b style={{ color: 'red' }}>Out of Stock</b>
              ) : Number(p.stock) <= 5 ? (
                <b style={{ color: '#d97706' }}>Low Stock Warning!</b>
              ) : null}
              <br />
              <button style={styles.gray} onClick={() => editProduct(p)}>
                Edit
              </button>
              <button style={styles.red} onClick={() => deleteProduct(p.id)}>
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
            <p>Selected Due Date: {dueDate || 'Abhi date select nahi hui'}</p>
          </div>
          <div style={styles.box}>
            <h3>Purane Bill ka Return</h3>
            <p>Customer ka purana bill number likh kar search karein. Return ki raqam naye bill se minus hogi.</p>
            <input style={styles.input} type="number" min="1" placeholder="Purana Bill Number" value={returnBillNumber} onChange={(e) => setReturnBillNumber(e.target.value)} />
            <button style={styles.gray} onClick={searchOldBillForReturn} disabled={loading}>Purana Bill Search Karein</button>
            {returnBill && <>
              <p><b>Bill #{returnBill.id}</b> — {returnBill.customer_name || '-'} — {returnBill.phone || '-'}</p>
              <p>Jin items ko wapas lena hai un par checkbox lagayein aur quantity likhein:</p>
              {returnableItems.map((item) => {
                const selection = returnSelections[item.product_id] || { checked: false, quantity: '1' };
                return <div key={item.product_id} style={styles.product}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 'bold' }}>
                    <input type="checkbox" checked={!!selection.checked} onChange={(e) => setReturnSelections((old) => ({ ...old, [item.product_id]: { ...selection, checked: e.target.checked } }))} />
                    {item.name}
                  </label>
                  <p>Original Qty: {item.original_quantity} | Pehle Return: {item.returned_quantity} | Ab Return ho sakti: {item.available_quantity}</p>
                  <p>Original Rate: {money(item.price)}</p>
                  <input style={styles.input} type="number" min="1" max={item.available_quantity} disabled={!selection.checked} value={selection.quantity} placeholder="Return Quantity" onChange={(e) => setReturnSelections((old) => ({ ...old, [item.product_id]: { ...selection, quantity: e.target.value } }))} />
                </div>;
              })}
              <button style={styles.green} onClick={applySelectedReturns}>Selected Return Items Add Karein</button>
            </>}
            {returnItems.map((item, index) => <p key={`${item.old_order_id}-${item.product_id}`}>{item.name}: {item.quantity} x {money(item.price)} = {money(item.quantity * item.price)} <button style={styles.red} onClick={() => setReturnItems((old) => old.filter((_, i) => i !== index))}>Remove Return</button></p>)}
            <b>Total Return: {money(returnTotal)}</b>
            {extraRefund > 0 && <><h4>Extra Return Amount: {money(extraRefund)}</h4><p>Extra paisay ka tareeqa select karein:</p><select style={styles.input} value={returnMethod} onChange={(e) => setReturnMethod(e.target.value)}><option value="cash">Cash Wapas Dein</option><option value="credit">Customer ke Udhar/Account Mein Jama Karein</option></select></>}
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
              {scannerOpen ? 'Scanner Band Karein' : 'Open Barcode Scanner'}
            </button>
            {scannerOpen && (
              <div
                id="barcode-reader"
                style={{ width: '100%', marginTop: 10 }}
              />
            )}
            <select
              style={styles.input}
              value={selectedProduct}
              onChange={(e) => {
                const p = products.find((x) => String(x.id) === e.target.value);
                setSelectedProduct(e.target.value);
                if (p) setSellingPrice(String(p.price || ''));
              }}
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={Number(p.stock) <= 0}>
                  {p.name} — Stock: {p.stock}
                </option>
              ))}
            </select>
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
            <hr style={{ margin: '18px 0', border: 0, borderTop: '1px solid #dbe3ec' }} />
            <h4>Multiple Products Ek Saath Select Karein</h4>
            <input style={styles.input} placeholder="Product name search karein..." value={billProductSearch} onChange={(e) => setBillProductSearch(e.target.value)} />
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #dbe3ec', borderRadius: 8, padding: 8 }}>
              {products.filter((p) => Number(p.stock) > 0 && p.name.toLowerCase().includes(billProductSearch.trim().toLowerCase())).map((p) => {
                const selection = billProductSelections[p.id] || { checked: false, quantity: '1', price: String(p.price || '') };
                return <div key={p.id} style={{ padding: '10px 4px', borderBottom: '1px solid #e5e7eb' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600 }}>
                    <input type="checkbox" checked={!!selection.checked} onChange={(e) => setBillProductSelections((old) => ({ ...old, [p.id]: { ...selection, checked: e.target.checked } }))} />
                    <span>{p.name} — Stock: {p.stock}</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 7 }}>
                    <input style={styles.input} type="number" min="1" max={p.stock} disabled={!selection.checked} placeholder="Quantity" value={selection.quantity} onChange={(e) => setBillProductSelections((old) => ({ ...old, [p.id]: { ...selection, quantity: e.target.value } }))} />
                    <input style={styles.input} type="number" min="0" disabled={!selection.checked} placeholder="Selling Price" value={selection.price} onChange={(e) => setBillProductSelections((old) => ({ ...old, [p.id]: { ...selection, price: e.target.value } }))} />
                  </div>
                </div>;
              })}
              {products.filter((p) => Number(p.stock) > 0 && p.name.toLowerCase().includes(billProductSearch.trim().toLowerCase())).length === 0 && <p>Koi available product nahi mila.</p>}
            </div>
            <button style={styles.green} onClick={addSelectedProductsToCart}>Selected Products Bill Mein Add Karein</button>
          </div>
          <h3>Bill Items</h3>
          {cart.map((item, index) => (
            <div style={styles.product} key={index}>
              <b>{item.name}</b>
              <p>Quantity: {item.quantity}</p>
              <p>Selling Price: {money(item.price)}</p>
              <p>Amount: {money(item.quantity * item.price)}</p>
              <button style={styles.red} onClick={() => removeCartItem(index)}>
                Remove
              </button>
            </div>
          ))}
          <div style={styles.box}>
            <p>Sale Subtotal: {money(salesSubtotal)}</p>
            <p>Return Minus: - {money(returnTotal)}</p>
            <h3>Net Bill Total: {money(payableTotal)}</h3>
            {extraRefund > 0 && <p>Customer ko wapas dene / account mein jama: {money(extraRefund)}</p>}
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
  );
}

const styles = {
  appShell: { minHeight: '100vh', background: '#f3f6fb', color: '#172b4d', fontFamily: 'Inter, Arial, sans-serif' },
  topHeader: { background: 'linear-gradient(120deg,#102b52,#174b83)', color: 'white', padding: '20px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 15, boxShadow: '0 4px 16px rgba(15,35,65,.16)' },
  headerLogout: { background: '#ffffff', color: '#15365e', border: 0, borderRadius: 9, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' },
  appLayout: { display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)', gap: 22, maxWidth: 1500, margin: '0 auto', padding: 22 },
  sidebar: { background: '#102b52', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 7, alignSelf: 'start', position: 'sticky', top: 16 },
  sidebarCaption: { color: '#93b4da', fontSize: 10, fontWeight: 800, letterSpacing: 1.4, padding: '13px 10px 5px' },
  navButton: { display: 'block', width: '100%', textAlign: 'left', color: '#e5efff', background: 'transparent', border: 0, borderRadius: 9, padding: '11px 12px', cursor: 'pointer', fontSize: 14, textDecoration: 'none' },
  navActive: { display: 'block', width: '100%', textAlign: 'left', color: '#102b52', background: '#ffffff', border: 0, borderRadius: 9, padding: '11px 12px', cursor: 'pointer', fontWeight: 800, fontSize: 14 },
  mainContent: { minWidth: 0, background: '#ffffff', borderRadius: 16, padding: 22, boxShadow: '0 4px 22px rgba(15,35,65,.06)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 13, margin: '15px 0 22px' },
  statCard: { background: '#f1f6ff', border: '1px solid #dce8f8', borderRadius: 13, padding: 17, display: 'flex', flexDirection: 'column', gap: 8 },
  sectionHeading: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '22px 0 12px', color: '#15365e' },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(235px,1fr))', gap: 15 },
  productCard: { border: '1px solid #e1e9f4', borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 3px 12px rgba(20,45,80,.05)' },
  productImage: { width: '100%', height: 155, objectFit: 'cover', display: 'block', background: '#f3f6fb' },
  imagePlaceholder: { height: 155, display: 'grid', placeItems: 'center', color: '#8294aa', background: '#edf2f8', fontWeight: 700 },
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
