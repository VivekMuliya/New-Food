-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 14, 2025 at 05:30 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `food_shop`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `description`, `display_order`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Punjabi Specials', 'Authentic North Indian Punjabi dishes', 1, 1, '2024-12-26 05:02:55', '2025-01-09 07:25:43'),
(2, 'Gujarati Delights', 'Traditional Gujarati cuisine', 2, 1, '2024-12-26 05:02:55', '2024-12-26 05:02:55'),
(3, 'South Indian', 'Popular South Indian dishes', 3, 1, '2024-12-26 05:02:55', '2024-12-28 09:55:20'),
(4, 'Chinese', 'Indo-Chinese favorites', 4, 1, '2024-12-26 05:02:55', '2024-12-30 01:31:53'),
(5, 'Desserts', 'Sweet endings to your meal', 5, 1, '2024-12-26 05:02:55', '2024-12-30 01:31:33');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `total_visits` int(11) DEFAULT 0,
  `total_spent` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_visit` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dishes`
--

CREATE TABLE `dishes` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `is_available` tinyint(1) DEFAULT 1,
  `category_id` int(11) DEFAULT NULL,
  `is_veg` tinyint(1) DEFAULT 1,
  `cuisine_type` varchar(50) DEFAULT NULL,
  `spice_level` enum('mild','medium','spicy') DEFAULT 'medium'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `dishes`
--

INSERT INTO `dishes` (`id`, `name`, `price`, `description`, `image_url`, `is_available`, `category_id`, `is_veg`, `cuisine_type`, `spice_level`) VALUES
(27, 'Butter Paneer', 14.98, 'Creamy, rich curry with tender chicken pieces', NULL, 0, 1, 1, NULL, 'medium'),
(28, 'Dal Makhani', 12.99, 'Creamy black lentils cooked overnight', 'uploads/dishes/optimized/67a2e216c7a65_1738727958.jpg', 1, 1, 1, NULL, 'medium'),
(29, 'Paneer Tikka', 11.99, 'Grilled cottage cheese with spices', 'uploads/dishes/optimized/679f7c0abd35a_1738505226.jpg', 1, 1, 1, NULL, 'medium'),
(30, 'Dhokla', 8.99, 'Steamed gram flour cake with spices', 'uploads/dishes/6775f23670a7d_1735782966.jpeg', 1, 2, 1, NULL, 'medium'),
(31, 'Thepla', 7.99, 'Multi-grain flatbread with spices', 'uploads/dishes/6775f23c601e1_1735782972.jpeg', 1, 2, 1, NULL, 'medium'),
(32, 'Undhiyu', 13.99, 'Mixed vegetable curry', 'uploads/dishes/6775f26e2e9f3_1735783022.jpeg', 1, 2, 1, NULL, 'medium'),
(33, 'Masala Dosa', 9.99, 'Crispy crepe with spiced potato filling', 'uploads/dishes/6775f27e0f875_1735783038.jpg', 1, 3, 1, NULL, 'medium'),
(34, 'Idli Sambar', 8.99, 'Steamed rice cakes with lentil soup', 'uploads/dishes/6775f277eaceb_1735783031.jpg', 1, 3, 1, NULL, 'medium'),
(35, 'Vada', 7.99, 'Crispy lentil doughnuts', 'uploads/dishes/6775f289075a5_1735783049.jpg', 1, 3, 1, NULL, 'medium'),
(36, 'Veg Manchurian', 10.99, 'Deep-fried vegetable balls in spicy sauce', 'uploads/dishes/6775f2b8ee28a_1735783096.jpg', 1, 4, 1, NULL, 'medium'),
(37, 'Hakka Noodles', 9.99, 'Stir-fried noodles with vegetables', 'uploads/dishes/6775f2ad94ab4_1735783085.jpg', 1, 4, 1, NULL, 'medium'),
(38, 'Chilli Paneer', 11.99, 'Spicy Indo-Chinese style paneer', 'uploads/dishes/6775f2a38bfd8_1735783075.jpg', 1, 4, 1, NULL, 'medium'),
(39, 'Gulab Jamun', 5.99, 'Sweet milk dough balls in sugar syrup', 'uploads/dishes/6775f2c47eb8a_1735783108.jpg', 1, 5, 1, NULL, 'medium'),
(41, 'Kheer', 4.99, 'Traditional rice pudding', 'uploads/dishes/6775f3001ad58_1735783168.jpeg', 1, 5, 1, NULL, 'medium'),
(42, 'Rasmalai', 14.00, 'Sweet cottage cheese dumplings in milk', 'uploads/dishes/6775f2de865c5_1735783134.jpeg', 1, 5, 1, NULL, 'medium'),
(43, 'Noodels', 16.00, 'Stir-fried noodles', 'uploads/dishes/6775f2b38d2a4_1735783091.jpg', 1, 4, 1, NULL, 'medium');

-- --------------------------------------------------------

--
-- Table structure for table `dish_preparation_times`
--

CREATE TABLE `dish_preparation_times` (
  `id` int(11) NOT NULL,
  `dish_id` int(11) NOT NULL,
  `avg_preparation_time` int(11) NOT NULL COMMENT 'in minutes',
  `station_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kitchen_stations`
--

CREATE TABLE `kitchen_stations` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `chef_id` int(11) DEFAULT NULL,
  `max_concurrent_orders` int(11) DEFAULT 5,
  `current_load` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `kitchen_stations`
--

INSERT INTO `kitchen_stations` (`id`, `name`, `description`, `is_active`, `created_at`, `chef_id`, `max_concurrent_orders`, `current_load`) VALUES
(1, 'Hot Kitchen', 'Main cooking station for hot dishes', 1, '2025-02-07 06:02:59', NULL, 5, 0),
(2, 'Cold Kitchen', 'Preparation of cold dishes and salads', 1, '2025-02-07 06:02:59', NULL, 5, 0),
(3, 'Grill Station', 'Grilling and BBQ items', 1, '2025-02-07 06:02:59', NULL, 5, 0),
(4, 'Dessert Station', 'Desserts and sweet preparations', 1, '2025-02-07 06:02:59', NULL, 5, 0);

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `restaurant_table_id` int(11) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `phone_number` varchar(15) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','card','upi') NOT NULL,
  `order_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('pending','processing','food_prepared','completed','modified') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_saved` tinyint(1) DEFAULT 0,
  `original_order_id` int(11) DEFAULT NULL,
  `chef_notes` text DEFAULT NULL,
  `special_requests` text DEFAULT NULL,
  `estimated_wait_time` int(11) DEFAULT NULL COMMENT 'in minutes',
  `preparation_start_time` timestamp NULL DEFAULT NULL,
  `preparation_end_time` timestamp NULL DEFAULT NULL,
  `bill_number` varchar(50) DEFAULT NULL,
  `order_type` enum('dine-in','takeaway','delivery') DEFAULT 'dine-in',
  `table_section` varchar(50) DEFAULT NULL,
  `waiter_id` int(11) DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `priority` enum('high','medium','low') DEFAULT 'medium',
  `has_new_items` tinyint(1) DEFAULT 0,
  `is_updated` tinyint(1) DEFAULT 0,
  `update_count` int(11) DEFAULT 0,
  `last_update_time` timestamp NULL DEFAULT NULL,
  `has_updates` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `restaurant_table_id`, `customer_name`, `phone_number`, `total_amount`, `payment_method`, `order_date`, `status`, `created_at`, `updated_at`, `is_saved`, `original_order_id`, `chef_notes`, `special_requests`, `estimated_wait_time`, `preparation_start_time`, `preparation_end_time`, `bill_number`, `order_type`, `table_section`, `waiter_id`, `customer_id`, `priority`, `has_new_items`, `is_updated`, `update_count`, `last_update_time`, `has_updates`) VALUES
(201, 19, 'ahmed', '2342434', 38.97, 'cash', '2025-02-12 13:14:26', 'completed', '2025-02-12 13:14:26', '2025-02-12 14:33:15', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'dine-in', NULL, NULL, NULL, 'medium', 0, 0, 0, NULL, 0),
(202, 20, 'aim', '2313123', 25.98, 'cash', '2025-02-12 13:15:57', 'completed', '2025-02-12 13:15:57', '2025-02-12 14:33:14', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'dine-in', NULL, NULL, NULL, 'medium', 0, 0, 0, NULL, 0),
(203, 19, 'ahmed', '241451515151', 38.97, 'cash', '2025-02-13 04:28:39', 'completed', '2025-02-13 04:28:39', '2025-02-13 05:49:45', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'dine-in', NULL, NULL, NULL, 'medium', 0, 0, 0, NULL, 0),
(204, 19, 'ahmed', '22242442', 25.98, 'cash', '2025-02-13 05:50:48', 'completed', '2025-02-13 05:50:48', '2025-02-13 06:01:27', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'dine-in', NULL, NULL, NULL, 'medium', 0, 0, 0, NULL, 0),
(205, 19, 'ahmed', '454646456', 25.98, 'cash', '2025-02-13 06:01:45', 'completed', '2025-02-13 06:01:45', '2025-02-13 14:23:09', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'dine-in', NULL, NULL, NULL, 'medium', 0, 0, 0, NULL, 0),
(206, 19, 'ahmed', '8780600947', 89.93, 'cash', '2025-02-13 14:26:11', 'processing', '2025-02-13 14:26:11', '2025-02-14 03:48:45', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'dine-in', NULL, NULL, NULL, 'medium', 0, 0, 0, NULL, 1),
(207, 20, 'azim', '23242423432', 127.88, 'cash', '2025-02-13 14:45:48', 'completed', '2025-02-13 14:45:48', '2025-02-14 03:48:44', 0, NULL, NULL, NULL, NULL, NULL, '2025-02-13 14:54:13', NULL, 'dine-in', NULL, NULL, NULL, 'medium', 0, 0, 0, NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `order_details`
--

CREATE TABLE `order_details` (
  `id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `dish_id` int(11) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `added_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_details`
--

INSERT INTO `order_details` (`id`, `order_id`, `dish_id`, `quantity`, `added_at`) VALUES
(450, 201, 28, 3, '2025-02-13 04:09:36'),
(451, 202, 28, 2, '2025-02-13 04:09:36'),
(452, 203, 28, 3, '2025-02-13 04:28:39'),
(453, 204, 28, 2, '2025-02-13 05:50:48'),
(454, 205, 28, 2, '2025-02-13 06:01:45'),
(455, 206, 28, 3, '2025-02-13 14:26:11'),
(456, 207, 28, 1, '2025-02-13 14:45:48'),
(457, 207, 28, 1, '2025-02-13 14:52:14'),
(458, 207, 29, 2, '2025-02-13 14:52:14'),
(459, 207, 31, 2, '2025-02-13 14:52:14'),
(460, 207, 28, 1, '2025-02-13 14:55:14'),
(461, 207, 29, 2, '2025-02-13 14:55:14'),
(462, 207, 31, 2, '2025-02-13 14:55:14'),
(463, 207, 30, 1, '2025-02-13 14:55:14'),
(464, 206, 28, 3, '2025-02-13 23:54:57'),
(465, 206, 29, 1, '2025-02-13 23:54:57');

-- --------------------------------------------------------

--
-- Table structure for table `order_feedback`
--

CREATE TABLE `order_feedback` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `dish_id` int(11) NOT NULL,
  `rating` int(11) DEFAULT NULL CHECK (`rating` between 1 and 5),
  `feedback` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_modifications`
--

CREATE TABLE `order_modifications` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `modification_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `previous_total` decimal(10,2) NOT NULL,
  `new_total` decimal(10,2) NOT NULL,
  `modification_notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_updates`
--

CREATE TABLE `order_updates` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `update_type` enum('new_items','status_change','special_request','order_modification') NOT NULL,
  `details` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_updates`
--

INSERT INTO `order_updates` (`id`, `order_id`, `update_type`, `details`, `created_at`) VALUES
(83, 201, 'status_change', '{\"new_status\":\"processing\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-12 14:15:11\"}', '2025-02-12 13:15:11'),
(84, 202, 'status_change', '{\"new_status\":\"processing\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-12 14:16:08\"}', '2025-02-12 13:16:08'),
(85, 202, 'status_change', '{\"new_status\":\"food_prepared\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-12 15:33:13\"}', '2025-02-12 14:33:13'),
(86, 202, 'status_change', '{\"new_status\":\"completed\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-12 15:33:14\"}', '2025-02-12 14:33:14'),
(87, 201, 'status_change', '{\"new_status\":\"food_prepared\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-12 15:33:15\"}', '2025-02-12 14:33:15'),
(88, 201, 'status_change', '{\"new_status\":\"completed\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-12 15:33:15\"}', '2025-02-12 14:33:15'),
(89, 203, 'status_change', '{\"new_status\":\"processing\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 06:49:30\"}', '2025-02-13 05:49:30'),
(90, 203, 'status_change', '{\"new_status\":\"food_prepared\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 06:49:41\"}', '2025-02-13 05:49:41'),
(91, 203, 'status_change', '{\"new_status\":\"completed\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 06:49:45\"}', '2025-02-13 05:49:45'),
(92, 204, 'status_change', '{\"new_status\":\"processing\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 07:01:26\"}', '2025-02-13 06:01:26'),
(93, 204, 'status_change', '{\"new_status\":\"food_prepared\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 07:01:27\"}', '2025-02-13 06:01:27'),
(94, 204, 'status_change', '{\"new_status\":\"completed\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 07:01:27\"}', '2025-02-13 06:01:27'),
(95, 205, 'status_change', '{\"new_status\":\"processing\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 07:02:26\"}', '2025-02-13 06:02:26'),
(96, 205, 'status_change', '{\"new_status\":\"food_prepared\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 15:23:08\"}', '2025-02-13 14:23:08'),
(97, 205, 'status_change', '{\"new_status\":\"completed\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 15:23:09\"}', '2025-02-13 14:23:09'),
(98, 207, '', '{\"added_dishes\":[{\"dishId\":28,\"quantity\":1,\"price\":12.99},{\"dishId\":29,\"quantity\":2,\"price\":11.99},{\"dishId\":31,\"quantity\":2,\"price\":7.99}],\"previous_total\":\"12.99\",\"new_total\":65.94}', '2025-02-13 14:52:14'),
(99, 207, 'status_change', '{\"new_status\":\"processing\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-13 15:53:44\"}', '2025-02-13 14:53:44'),
(100, 207, 'status_change', '{\"previous_status\":\"processing\",\"new_status\":\"food_prepared\",\"changed_by\":\"chef\",\"timestamp\":\"2025-02-13 15:54:13\"}', '2025-02-13 14:54:13'),
(101, 207, '', '{\"added_dishes\":[{\"dishId\":28,\"quantity\":1,\"price\":12.99},{\"dishId\":29,\"quantity\":2,\"price\":11.99},{\"dishId\":31,\"quantity\":2,\"price\":7.99},{\"dishId\":30,\"quantity\":1,\"price\":8.99}],\"previous_total\":\"65.94\",\"new_total\":127.88}', '2025-02-13 14:55:14'),
(102, 206, '', '{\"added_dishes\":[{\"dishId\":28,\"quantity\":3,\"price\":12.99},{\"dishId\":29,\"quantity\":1,\"price\":11.99}],\"previous_total\":\"38.97\",\"new_total\":89.92999999999999}', '2025-02-13 23:54:57'),
(103, 207, 'status_change', '{\"new_status\":\"completed\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-14 04:48:44\"}', '2025-02-14 03:48:44'),
(104, 206, 'status_change', '{\"new_status\":\"processing\",\"changed_by\":\"admin\",\"timestamp\":\"2025-02-14 04:48:45\"}', '2025-02-14 03:48:45');

-- --------------------------------------------------------

--
-- Table structure for table `restaurant_sections`
--

CREATE TABLE `restaurant_sections` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `restaurant_tables`
--

CREATE TABLE `restaurant_tables` (
  `id` int(11) NOT NULL,
  `table_number` int(11) NOT NULL,
  `capacity` int(11) DEFAULT 4,
  `status` enum('free','booked','reserved') DEFAULT 'free',
  `last_order_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `section_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `restaurant_tables`
--

INSERT INTO `restaurant_tables` (`id`, `table_number`, `capacity`, `status`, `last_order_id`, `created_at`, `updated_at`, `section_id`) VALUES
(19, 1, 2, 'booked', 206, '2025-02-12 13:13:51', '2025-02-13 14:26:11', NULL),
(20, 2, 2, 'free', 207, '2025-02-12 13:13:53', '2025-02-14 03:48:44', NULL),
(21, 3, 3, 'free', NULL, '2025-02-12 13:13:56', '2025-02-12 13:13:56', NULL),
(22, 4, 6, 'free', NULL, '2025-02-13 04:02:40', '2025-02-13 04:02:40', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `revenue`
--

CREATE TABLE `revenue` (
  `id` int(11) NOT NULL,
  `total_revenue` decimal(10,2) NOT NULL,
  `date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff`
--

CREATE TABLE `staff` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `role` enum('waiter','chef','manager','admin') NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`);

--
-- Indexes for table `dishes`
--
ALTER TABLE `dishes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id_2` (`category_id`);

--
-- Indexes for table `dish_preparation_times`
--
ALTER TABLE `dish_preparation_times`
  ADD PRIMARY KEY (`id`),
  ADD KEY `dish_id` (`dish_id`),
  ADD KEY `station_id` (`station_id`);

--
-- Indexes for table `kitchen_stations`
--
ALTER TABLE `kitchen_stations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `chef_id` (`chef_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `bill_number` (`bill_number`),
  ADD KEY `orders_table_fk` (`restaurant_table_id`),
  ADD KEY `idx_orders_status` (`status`),
  ADD KEY `idx_orders_created_at` (`created_at`),
  ADD KEY `idx_is_saved` (`is_saved`),
  ADD KEY `waiter_id` (`waiter_id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `idx_is_updated` (`is_updated`),
  ADD KEY `idx_original_order_id` (`original_order_id`),
  ADD KEY `idx_priority` (`priority`);

--
-- Indexes for table `order_details`
--
ALTER TABLE `order_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `dish_id` (`dish_id`);

--
-- Indexes for table `order_feedback`
--
ALTER TABLE `order_feedback`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `dish_id` (`dish_id`);

--
-- Indexes for table `order_modifications`
--
ALTER TABLE `order_modifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `order_updates`
--
ALTER TABLE `order_updates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `restaurant_sections`
--
ALTER TABLE `restaurant_sections`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `restaurant_tables`
--
ALTER TABLE `restaurant_tables`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `table_number` (`table_number`),
  ADD KEY `idx_restaurant_tables_status` (`status`),
  ADD KEY `section_id` (`section_id`);

--
-- Indexes for table `revenue`
--
ALTER TABLE `revenue`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `staff`
--
ALTER TABLE `staff`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dishes`
--
ALTER TABLE `dishes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=46;

--
-- AUTO_INCREMENT for table `dish_preparation_times`
--
ALTER TABLE `dish_preparation_times`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kitchen_stations`
--
ALTER TABLE `kitchen_stations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=208;

--
-- AUTO_INCREMENT for table `order_details`
--
ALTER TABLE `order_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=466;

--
-- AUTO_INCREMENT for table `order_feedback`
--
ALTER TABLE `order_feedback`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_modifications`
--
ALTER TABLE `order_modifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_updates`
--
ALTER TABLE `order_updates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=105;

--
-- AUTO_INCREMENT for table `restaurant_sections`
--
ALTER TABLE `restaurant_sections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `restaurant_tables`
--
ALTER TABLE `restaurant_tables`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `revenue`
--
ALTER TABLE `revenue`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `staff`
--
ALTER TABLE `staff`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `dishes`
--
ALTER TABLE `dishes`
  ADD CONSTRAINT `dishes_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`);

--
-- Constraints for table `dish_preparation_times`
--
ALTER TABLE `dish_preparation_times`
  ADD CONSTRAINT `dish_prep_times_dish_fk` FOREIGN KEY (`dish_id`) REFERENCES `dishes` (`id`),
  ADD CONSTRAINT `dish_prep_times_station_fk` FOREIGN KEY (`station_id`) REFERENCES `kitchen_stations` (`id`);

--
-- Constraints for table `kitchen_stations`
--
ALTER TABLE `kitchen_stations`
  ADD CONSTRAINT `kitchen_stations_ibfk_1` FOREIGN KEY (`chef_id`) REFERENCES `staff` (`id`);

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`waiter_id`) REFERENCES `staff` (`id`),
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `orders_table_fk` FOREIGN KEY (`restaurant_table_id`) REFERENCES `restaurant_tables` (`id`);

--
-- Constraints for table `order_details`
--
ALTER TABLE `order_details`
  ADD CONSTRAINT `order_details_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_details_ibfk_2` FOREIGN KEY (`dish_id`) REFERENCES `dishes` (`id`);

--
-- Constraints for table `order_feedback`
--
ALTER TABLE `order_feedback`
  ADD CONSTRAINT `order_feedback_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_feedback_ibfk_2` FOREIGN KEY (`dish_id`) REFERENCES `dishes` (`id`);

--
-- Constraints for table `order_modifications`
--
ALTER TABLE `order_modifications`
  ADD CONSTRAINT `order_modifications_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);

--
-- Constraints for table `order_updates`
--
ALTER TABLE `order_updates`
  ADD CONSTRAINT `order_updates_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);

--
-- Constraints for table `restaurant_tables`
--
ALTER TABLE `restaurant_tables`
  ADD CONSTRAINT `restaurant_tables_ibfk_1` FOREIGN KEY (`section_id`) REFERENCES `restaurant_sections` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
