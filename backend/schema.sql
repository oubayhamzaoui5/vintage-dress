CREATE DATABASE IF NOT EXISTS vintage_dress CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vintage_dress;

CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('principal','secondaire') NOT NULL DEFAULT 'secondaire',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  phone VARCHAR(30), city VARCHAR(80),
  blocked TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock INT NOT NULL DEFAULT 20 CHECK (stock >= 0),
  image VARCHAR(500),
  category_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  status ENUM('En attente','Expédiée','Livrée','Annulée') NOT NULL DEFAULT 'En attente',
  total DECIMAL(10,2) NOT NULL,
  customer_name VARCHAR(100), phone VARCHAR(30), city VARCHAR(80), address VARCHAR(500),
  shipping DECIMAL(10,2) NOT NULL DEFAULT 8,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'Paiement à la livraison',
  request_key CHAR(36), request_hash CHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY orders_user_request_unique (user_id, request_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  size VARCHAR(10), color VARCHAR(30),
  product_name VARCHAR(150), image VARCHAR(500),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE addresses (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL, phone VARCHAR(30) NOT NULL,
  city VARCHAR(80) NOT NULL, address VARCHAR(500) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE favorites (
  user_id INT NOT NULL, product_id INT NOT NULL, PRIMARY KEY(user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE notification_preferences (
  user_id INT PRIMARY KEY, orders TINYINT(1) NOT NULL DEFAULT 1,
  offers TINYINT(1) NOT NULL DEFAULT 0, news TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
