const categories = [
  {
    name: 'Fruits & Vegetables',
    description: 'Picked this morning and packed cold.',
    emoji: '🥬',
    tint: '#E5F6D8',
    sortOrder: 1,
    products: [
      { name: 'Robusta Banana', brand: 'Hill Orchard', price: 48, mrp: 62, unit: '1 dozen', stock: 80, emoji: '🍌', tint: '#FFF4C2', tags: ['fruit', 'banana'], description: 'Ripe, firm bananas for breakfast or a late-night snack.' },
      { name: 'Shimla Apple', brand: 'Hill Orchard', price: 129, mrp: 169, unit: '4 pcs', stock: 46, emoji: '🍎', tint: '#FDE8E8', tags: ['fruit', 'apple'], description: 'Crisp and lightly sweet. Kept chilled from the valley.' },
      { name: 'Desi Tomato', brand: 'Local Mandi', price: 28, mrp: 36, unit: '500 g', stock: 90, emoji: '🍅', tint: '#FDECEC', tags: ['vegetable', 'tomato'], description: 'Juicy tomatoes for dal, salads, and weekday curries.' },
      { name: 'English Cucumber', brand: 'Local Mandi', price: 32, mrp: 40, unit: '500 g', stock: 54, emoji: '🥒', tint: '#E5F6D8', tags: ['vegetable'], description: 'Cool, watery cucumbers with a thin skin.' },
      { name: 'Baby Spinach', brand: 'Green Crate', price: 39, mrp: 49, unit: '200 g', stock: 36, emoji: '🥬', tint: '#E7F8E4', tags: ['leafy', 'spinach'], description: 'Washed baby spinach ready for a quick sauté.' },
      { name: 'Pink Onion', brand: 'Local Mandi', price: 34, mrp: 42, unit: '1 kg', stock: 70, emoji: '🧅', tint: '#F8E7F2', tags: ['vegetable', 'onion'], description: 'The everyday onion, sorted and weighed.' },
    ],
  },
  {
    name: 'Dairy & Breakfast',
    description: 'Milk, curd, eggs, and the rest of the morning.',
    emoji: '🥛',
    tint: '#FFF3D6',
    sortOrder: 2,
    products: [
      { name: 'Toned Milk', brand: 'Morning Pour', price: 28, mrp: 32, unit: '500 ml', stock: 120, emoji: '🥛', tint: '#F4FAFF', tags: ['milk', 'dairy'], description: 'Chilled toned milk in a resealable pack.' },
      { name: 'Greek Yogurt', brand: 'Morning Pour', price: 95, mrp: 120, unit: '400 g', stock: 40, emoji: '🥣', tint: '#FFF8EA', tags: ['yogurt', 'dairy'], description: 'Thick yogurt with a clean, tart finish.' },
      { name: 'Salted Butter', brand: 'Churn Co', price: 58, mrp: 62, unit: '100 g', stock: 64, emoji: '🧈', tint: '#FFF4CC', tags: ['butter'], description: 'Slow-churned salted butter for toast and parathas.' },
      { name: 'Farm Eggs', brand: 'Nest Lane', price: 48, mrp: 60, unit: '6 pcs', stock: 75, emoji: '🥚', tint: '#FFF7E8', tags: ['eggs'], description: 'Brown eggs from nearby farms, packed in a tray.' },
      { name: 'Malai Paneer', brand: 'Churn Co', price: 90, mrp: 110, unit: '200 g', stock: 42, emoji: '🧀', tint: '#FFF8EA', tags: ['paneer'], description: 'Soft malai paneer that holds its shape in a curry.' },
    ],
  },
  {
    name: 'Snacks & Munchies',
    description: 'Salty, crunchy, and gone before the tea cools.',
    emoji: '🍿',
    tint: '#FDE8D0',
    sortOrder: 3,
    products: [
      { name: 'Roasted Peanuts', brand: 'Kettle Yard', price: 49, mrp: 60, unit: '200 g', stock: 58, emoji: '🥜', tint: '#F8E6C8', tags: ['snacks', 'peanut'], description: 'Lightly salted peanuts roasted in small batches.' },
      { name: 'Masala Potato Chips', brand: 'Kettle Yard', price: 20, mrp: 20, unit: '52 g', stock: 100, emoji: '🥔', tint: '#FFF1D6', tags: ['chips'], description: 'Thin chips with a hot masala dust.' },
      { name: '70% Dark Chocolate', brand: 'Cacao Post', price: 99, mrp: 130, unit: '80 g', stock: 44, emoji: '🍫', tint: '#F3E4D7', tags: ['chocolate'], description: 'A snap of dark chocolate with cocoa nibs.' },
      { name: 'Roasted Makhana', brand: 'Kettle Yard', price: 85, mrp: 110, unit: '100 g', stock: 38, emoji: '🌾', tint: '#F7F0DE', tags: ['makhana'], description: 'Fox nuts tossed with pepper and rock salt.' },
    ],
  },
  {
    name: 'Cold Drinks',
    description: 'Chilled bottles for the walk back.',
    emoji: '🥤',
    tint: '#E3F2FD',
    sortOrder: 4,
    products: [
      { name: 'Orange Juice', brand: 'Pulp Room', price: 110, mrp: 140, unit: '1 L', stock: 30, emoji: '🍊', tint: '#FFE8CC', tags: ['juice'], description: 'Not-from-concentrate orange juice, kept cold.' },
      { name: 'Sparkling Water', brand: 'Pulp Room', price: 40, mrp: 50, unit: '750 ml', stock: 48, emoji: '💧', tint: '#E7F4FF', tags: ['water'], description: 'Unsweetened sparkling water with a fine bubble.' },
      { name: 'Cold Coffee', brand: 'Night Shift', price: 45, mrp: 55, unit: '200 ml', stock: 60, emoji: '☕', tint: '#F3E6D8', tags: ['coffee'], description: 'Sweet cold coffee in a ready-to-drink bottle.' },
      { name: 'Tender Coconut Water', brand: 'Pulp Room', price: 40, mrp: 50, unit: '200 ml', stock: 4, emoji: '🥥', tint: '#E9F8EF', tags: ['coconut'], description: 'Pressed coconut water. Stock runs out fast.' },
    ],
  },
  {
    name: 'Instant Food',
    description: 'A real meal when the day got away from you.',
    emoji: '🍜',
    tint: '#FCE4EC',
    sortOrder: 5,
    products: [
      { name: 'Masala Oats Cup', brand: 'Weeknight', price: 45, mrp: 55, unit: '1 cup', stock: 70, emoji: '🥣', tint: '#FDECC8', tags: ['oats'], description: 'Just add hot water. Ready in three minutes.' },
      { name: 'Cup Noodles', brand: 'Weeknight', price: 60, mrp: 70, unit: '1 cup', stock: 80, emoji: '🍜', tint: '#FDE7D2', tags: ['noodles'], description: 'Masala noodles with a separate seasoning sachet.' },
      { name: 'Thick Poha', brand: 'Weeknight', price: 55, mrp: 68, unit: '500 g', stock: 40, emoji: '🍚', tint: '#FFF6D8', tags: ['poha'], description: 'Flattened rice that fluffs up for a fast breakfast.' },
      { name: 'Instant Upma Mix', brand: 'Weeknight', price: 70, mrp: 85, unit: '200 g', stock: 34, emoji: '🍛', tint: '#FFF1D0', tags: ['upma'], description: 'Roasted rava mix with vegetables and curry leaf.' },
    ],
  },
  {
    name: 'Bakery',
    description: 'Bread and a few things worth the detour.',
    emoji: '🍞',
    tint: '#FFF8E1',
    sortOrder: 6,
    products: [
      { name: 'Sourdough Loaf', brand: 'Oven Hour', price: 89, mrp: 110, unit: '400 g', stock: 22, emoji: '🍞', tint: '#F8E7C9', tags: ['bread'], description: 'An overnight loaf with a crackly crust.' },
      { name: 'Butter Croissant', brand: 'Oven Hour', price: 55, mrp: 70, unit: '1 pc', stock: 28, emoji: '🥐', tint: '#FDE7C2', tags: ['croissant'], description: 'Laminated with butter and baked this morning.' },
      { name: 'Multigrain Cookies', brand: 'Oven Hour', price: 75, mrp: 90, unit: '150 g', stock: 36, emoji: '🍪', tint: '#F6E2C4', tags: ['cookies'], description: 'Jaggery cookies with oats and sesame.' },
    ],
  },
  {
    name: 'Personal Care',
    description: 'The small things you notice only when they run out.',
    emoji: '🧴',
    tint: '#E8F5E9',
    sortOrder: 7,
    products: [
      { name: 'Herbal Shampoo', brand: 'Stillwater', price: 149, mrp: 189, unit: '180 ml', stock: 26, emoji: '🧴', tint: '#E5F6EA', tags: ['shampoo'], description: 'A gentle daily shampoo with hibiscus.' },
      { name: 'Aloe Face Wash', brand: 'Stillwater', price: 120, mrp: 150, unit: '100 ml', stock: 30, emoji: '🫧', tint: '#E7F8F2', tags: ['face wash'], description: 'Gel wash that does not leave skin tight.' },
      { name: 'Neem Soap', brand: 'Stillwater', price: 99, mrp: 120, unit: '3 pcs', stock: 40, emoji: '🧼', tint: '#E8F6D8', tags: ['soap'], description: 'A three-pack of neem and coconut oil soap.' },
    ],
  },
  {
    name: 'Home Cleaning',
    description: 'Refills for the sink, the floor, and the kitchen shelf.',
    emoji: '🧹',
    tint: '#EDE7F6',
    sortOrder: 8,
    products: [
      { name: 'Dishwash Gel', brand: 'Clear Sink', price: 99, mrp: 125, unit: '500 ml', stock: 33, emoji: '🍽️', tint: '#E7F3FF', tags: ['dishwash'], description: 'Lemon dishwash gel that cuts through oil.' },
      { name: 'Floor Cleaner', brand: 'Clear Sink', price: 145, mrp: 175, unit: '1 L', stock: 24, emoji: '🧹', tint: '#EDE7F6', tags: ['floor'], description: 'A pine-free floor cleaner with a light citrus smell.' },
      { name: 'Facial Tissues', brand: 'Clear Sink', price: 65, mrp: 80, unit: '100 pulls', stock: 50, emoji: '🧻', tint: '#F7F4EE', tags: ['tissue'], description: 'Soft two-ply tissues in a counter box.' },
    ],
  },
];

const coupons = [
  {
    code: 'WELCOME50',
    description: '₹50 off your first full basket',
    type: 'flat',
    value: 50,
    minOrder: 199,
    maxDiscount: 50,
    usageLimit: 500,
  },
  {
    code: 'FRESH10',
    description: '10% off fresh orders, up to ₹80',
    type: 'percent',
    value: 10,
    minOrder: 249,
    maxDiscount: 80,
    usageLimit: 1000,
  },
  {
    code: 'ZAP20',
    description: '20% off when you stock the kitchen',
    type: 'percent',
    value: 20,
    minOrder: 399,
    maxDiscount: 100,
    usageLimit: 300,
  },
];

const users = [
  {
    name: 'Meera Iyer',
    email: 'admin@zapbasket.dev',
    phone: '9810098100',
    password: 'Admin@12345',
    role: 'admin',
  },
  {
    name: 'Aisha Khan',
    email: 'aisha@zapbasket.dev',
    phone: '9845012345',
    password: 'Customer@123',
    role: 'customer',
  },
  {
    name: 'Ravi Shetty',
    email: 'ravi@zapbasket.dev',
    phone: '9900011122',
    password: 'Delivery@123',
    role: 'delivery',
  },
];

module.exports = { categories, coupons, users };
