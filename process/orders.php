<?php
header('Content-Type: application/json');
include '../db.php';

$action = $_GET['action'] ?? '';

try {
    switch($action) {
        case 'get_pending':
            $query = "
                SELECT 
                    o.*,
                    CONCAT(o.customer_name, ' (', o.phone_number, ')') as customer_info,
                    CONCAT('$', o.total_amount, ' - ', UPPER(o.payment_method)) as payment_info,
                    GROUP_CONCAT(
                        CONCAT(
                            c.name, 
                            ': ', 
                            d.name, 
                            ' (', 
                            od.quantity, 
                            ')'
                        )
                        ORDER BY c.name 
                        SEPARATOR ' | '
                    ) as ordered_dishes
                FROM orders o
                LEFT JOIN order_details od ON o.id = od.order_id
                LEFT JOIN dishes d ON od.dish_id = d.id
                LEFT JOIN categories c ON d.category_id = c.id
                WHERE o.status = 'pending'
                GROUP BY o.id, o.customer_name, o.restaurant_table_id , o.total_amount, o.status, o.phone_number, o.payment_method
                ORDER BY o.created_at DESC
            ";
            
            $stmt = $pdo->query($query);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $orders
            ]);
            break;
            case 'get_completed':
                $query = "
                    SELECT 
                        o.*,
                        rt.table_number,
                        o.bill_generated,
                        o.bill_amount,
                        GROUP_CONCAT(
                            CONCAT(
                                COALESCE(c.name, 'Other'), 
                                ': ', 
                                d.name, 
                                ' (', 
                                od.quantity, 
                                ')'
                            )
                            ORDER BY c.name 
                            SEPARATOR ' | '
                        ) as ordered_dishes
                    FROM orders o
                    JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
                    LEFT JOIN order_details od ON o.id = od.order_id
                    LEFT JOIN dishes d ON od.dish_id = d.id
                    LEFT JOIN categories c ON d.category_id = c.id
                    WHERE o.status IN ('completed', 'bill_generated')
                    GROUP BY o.id, o.restaurant_table_id, o.customer_name, o.total_amount, o.status, o.phone_number, o.payment_method, rt.table_number, o.created_at, o.bill_generated, o.bill_amount
                    ORDER BY o.created_at DESC
                    LIMIT 100
                ";
                $stmt = $pdo->query($query);
                $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode([
                    'success' => true,
                    'data' => $orders,
                    'count' => count($orders)
                ]);
                break;
                case 'generate_bill':
                    $data = json_decode(file_get_contents('php://input'), true);
                    $orderId = $data['orderId'] ?? null;
                    if (!$orderId) {
                        throw new Exception('Order ID is required');
                    }
                    // Update the order status to 'bill_generated' and set related fields
                    $stmt = $pdo->prepare("
                        UPDATE orders 
                        SET status = 'bill_generated', 
                            bill_generated = 1, 
                            bill_amount = total_amount,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND status = 'completed'
                    ");
                    $stmt->execute([$orderId]);
                    if ($stmt->rowCount() === 0) {
                        throw new Exception('Order not found or not completed');
                    }
                    echo json_encode([
                        'success' => true,
                        'message' => 'Bill generated successfully'
                    ]);
                    break;
        case 'get_pending_count':
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM orders WHERE status = 'processing'");
            echo json_encode([
                'success' => true,
                'pending_count' => (int)$stmt->fetchColumn()
            ]);
            break;

        case 'get_completed_count':
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM orders WHERE status = 'bill_generated'");
            echo json_encode([
                'success' => true,
                'completed_count' => (int)$stmt->fetchColumn()
            ]);
            break;
 
            case 'get_popular_dishes':
                $query = "
                    SELECT 
                        d.name,
                        COUNT(*) as order_count 
                    FROM order_details od
                    JOIN dishes d ON od.dish_id = d.id
                    JOIN orders o ON od.order_id = o.id
                    WHERE o.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
                    GROUP BY d.id, d.name
                    ORDER BY order_count DESC 
                    LIMIT 3
                ";
                
                $stmt = $pdo->query($query);
                $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                $popularDishes = array_column($results, 'name');
                $orderCounts = array_column($results, 'order_count');
                
                echo json_encode([
                    'success' => true,
                    'popular_dishes' => $popularDishes,
                    'order_counts' => $orderCounts
                ]);
                break;
                case 'update':
                    $input = json_decode(file_get_contents('php://input'), true);
                    
                    if (!isset($input['id']) || !isset($input['status'])) {
                        throw new Exception('Order ID and status are required');
                    }
                
                    $stmt = $pdo->prepare("
                        UPDATE orders 
                        SET status = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ");
                    
                    $pdo->beginTransaction();
                
                    try {
                        $result = $stmt->execute([$input['status'], $input['id']]);
                        
                        if ($result) {
                            // Record the status change in order_updates
                            $stmt = $pdo->prepare("
                                INSERT INTO order_updates (
                                    order_id, 
                                    update_type, 
                                    details
                                ) VALUES (?, 'status_change', ?)
                            ");
                            
                            $details = json_encode([
                                'new_status' => $input['status'],
                                'changed_by' => 'admin',
                                'timestamp' => date('Y-m-d H:i:s')
                            ]);
                            $stmt->execute([$input['id'], $details]);
                
                            // If the new status is 'completed', reset the table status to 'free'
                            if ($input['status'] === 'completed') {
                                // Fetch the restaurant_table_id for the order
                                $stmt = $pdo->prepare("SELECT restaurant_table_id FROM orders WHERE id = ?");
                                $stmt->execute([$input['id']]);
                                $tableId = $stmt->fetchColumn();
                
                                if ($tableId) {
                                    // Reset the table status to 'free' and clear last_order_id
                                    $stmt = $pdo->prepare("
                                        UPDATE restaurant_tables 
                                        SET status = 'free', 
                                            last_order_id = NULL,
                                            updated_at = CURRENT_TIMESTAMP
                                        WHERE id = ?
                                    ");
                                    $stmt->execute([$tableId]);
                                } else {
                                    error_log("update: No table found for order ID {$input['id']}");
                                }
                            }
                
                            // If new dishes are added (assumed to be handled by waiter panel), ensure preparation_status is pending
                            if (isset($input['added_dishes'])) {
                                foreach ($input['added_dishes'] as $dish) {
                                    $stmt = $pdo->prepare("
                                        INSERT INTO order_details (order_id, dish_id, quantity, preparation_status, is_new)
                                        VALUES (?, ?, ?, 'pending', 1)
                                    ");
                                    $stmt->execute([$input['id'], $dish['dishId'], $dish['quantity']]);
                                }
                
                                // Record the update in order_updates
                                $stmt = $pdo->prepare("
                                    INSERT INTO order_updates (
                                        order_id, 
                                        update_type, 
                                        details
                                    ) VALUES (?, 'new_items', ?)
                                ");
                                $details = json_encode([
                                    'added_dishes' => $input['added_dishes'],
                                    'total_amount_added' => array_sum(array_column($input['added_dishes'], 'price')),
                                    'timestamp' => date('Y-m-d H:i:s')
                                ]);
                                $stmt->execute([$input['id'], $details]);
                            }
                
                            $pdo->commit();
                            echo json_encode(['success' => true]);
                        } else {
                            throw new Exception('Failed to update order status');
                        }
                    } catch (Exception $e) {
                        $pdo->rollBack();
                        error_log("update failed for order ID {$input['id']}: " . $e->getMessage());
                        throw $e;
                    }
                    break;

        case 'search':
            if (!isset($_GET['query'])) {
                throw new Exception('Search query is required');
            }

            $query = '%' . $_GET['query'] . '%';
            $stmt = $pdo->prepare("
                SELECT 
                    o.*,
                    GROUP_CONCAT(
                        CONCAT(d.name, ' (', od.quantity, ')')
                        SEPARATOR ', '
                    ) as ordered_dishes
                FROM orders o
                LEFT JOIN order_details od ON o.id = od.order_id
                LEFT JOIN dishes d ON od.dish_id = d.id
                WHERE 
                    o.id LIKE ? OR
                    o.customer_name LIKE ? OR
                    o.restaurant_table_id LIKE ?
                GROUP BY o.id
                ORDER BY o.created_at DESC
                LIMIT 50
            ");
            
            $stmt->execute([$query, $query, $query]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $results
            ]);
            break;

        case 'check_new_orders':
            $lastCheck = $_POST['last_check'] ?? date('Y-m-d H:i:s', strtotime('-1 minute'));
            
            $stmt = $pdo->prepare("
                SELECT COUNT(*) 
                FROM orders 
                WHERE status = 'processing' 
                AND created_at > ?
            ");
            
            $stmt->execute([$lastCheck]);
            
            echo json_encode([
                'success' => true,
                'new_orders_count' => (int)$stmt->fetchColumn(),
                'current_time' => date('Y-m-d H:i:s')
            ]);
            break;
            case 'get_payment_stats':
                $timeframe = $_GET['timeframe'] ?? 'today';
                
                try {
                    // Log the request
                    error_log("Payment stats request for timeframe: " . $timeframe);
                    
                    // Set the date range based on timeframe
                    switch($timeframe) {
                        case 'week':
                            $start_date = date('Y-m-d', strtotime('-7 days'));
                            break;
                        case 'month':
                            $start_date = date('Y-m-d', strtotime('-30 days'));
                            break;
                        default: // today
                            $start_date = date('Y-m-d');
                            break;
                    }
            
                    // Get total counts per payment method
                    $stmt = $pdo->prepare("
                        SELECT 
                            payment_method,
                            COUNT(*) as count,
                            SUM(total_amount) as total_amount
                        FROM orders 
                        WHERE DATE(created_at) >= ?
                        GROUP BY payment_method
                    ");
                    $stmt->execute([$start_date]);
                    $total_counts = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    // Log total counts
                    error_log("Total counts: " . json_encode($total_counts));
            
                    // Get daily statistics
                    $stmt = $pdo->prepare("
                        SELECT 
                            DATE(created_at) as date,
                            payment_method,
                            COUNT(*) as count
                        FROM orders 
                        WHERE DATE(created_at) >= ?
                        GROUP BY DATE(created_at), payment_method
                        ORDER BY date DESC
                    ");
                    $stmt->execute([$start_date]);
                    $daily_stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    // Log daily stats
                    error_log("Daily stats: " . json_encode($daily_stats));
            
                    // Initialize response
                    $response = [
                        'cash_count' => 0,
                        'upi_count' => 0,
                        'card_count' => 0,
                        'daily_stats' => []
                    ];
            
                    // Process total counts
                    foreach ($total_counts as $count) {
                        switch (strtolower($count['payment_method'])) {
                            case 'cash':
                                $response['cash_count'] = (int)$count['count'];
                                break;
                            case 'upi':
                                $response['upi_count'] = (int)$count['count'];
                                break;
                            case 'card':
                                $response['card_count'] = (int)$count['count'];
                                break;
                        }
                    }
            
                    // Process daily stats
                    $daily_data = [];
                    $dates = [];
                    
                    // First, get all unique dates
                    foreach ($daily_stats as $stat) {
                        if (!in_array($stat['date'], $dates)) {
                            $dates[] = $stat['date'];
                        }
                    }
                    
                    // Initialize data for all dates
                    foreach ($dates as $date) {
                        $daily_data[$date] = [
                            'date' => $date,
                            'cash_count' => 0,
                            'upi_count' => 0,
                            'card_count' => 0
                        ];
                    }
                    
                    // Fill in the actual counts
                    foreach ($daily_stats as $stat) {
                        $date = $stat['date'];
                        switch (strtolower($stat['payment_method'])) {
                            case 'cash':
                                $daily_data[$date]['cash_count'] = (int)$stat['count'];
                                break;
                            case 'upi':
                                $daily_data[$date]['upi_count'] = (int)$stat['count'];
                                break;
                            case 'card':
                                $daily_data[$date]['card_count'] = (int)$stat['count'];
                                break;
                        }
                    }
            
                    // Sort by date
                    ksort($daily_data);
                    $response['daily_stats'] = array_values($daily_data);
            
                    // Log final response
                    error_log("Final response: " . json_encode($response));
            
                    echo json_encode([
                        'success' => true,
                        'data' => $response
                    ]);
            
                } catch (PDOException $e) {
                    error_log("Payment stats error: " . $e->getMessage());
                    echo json_encode([
                        'success' => false,
                        'error' => 'Database error: ' . $e->getMessage()
                    ]);
                }
                break;
                case 'get_today_revenue':
                    // Get start and end of today
                    $start_of_day = date('Y-m-d 00:00:00');
                    $end_of_day = date('Y-m-d 23:59:59');
                    
                    // Query to get sum of total_amount for completed orders today
                    $stmt = $pdo->prepare("
                        SELECT COALESCE(SUM(total_amount), 0) as revenue
                        FROM orders 
                        WHERE status = 'bill_generated'
                        AND created_at BETWEEN ? AND ?
                    ");
                    
                    $stmt->execute([$start_of_day, $end_of_day]);
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    echo json_encode([
                        'success' => true,
                        'revenue' => $result['revenue']
                    ]);
                    break;

                    case 'create':
                        $data = json_decode(file_get_contents('php://input'), true);
                        
                        if (!isset($data['restaurant_table_id']) || 
                            !isset($data['customer_name']) || 
                            !isset($data['phone_number']) || 
                            !isset($data['total_amount']) || 
                            !isset($data['payment_method']) || 
                            !isset($data['dishes'])) {
                            throw new Exception('Missing required fields');
                        }
                    
                        $pdo->beginTransaction();
                    
                        // Insert the order with status = 'processing'
                        $stmt = $pdo->prepare("
                            INSERT INTO orders (
                                restaurant_table_id, 
                                customer_name, 
                                phone_number, 
                                total_amount, 
                                payment_method, 
                                status, 
                                created_at, 
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, 'processing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ");
                        $stmt->execute([
                            $data['restaurant_table_id'],
                            $data['customer_name'],
                            $data['phone_number'],
                            $data['total_amount'],
                            $data['payment_method']
                        ]);
                    
                        $orderId = $pdo->lastInsertId();
                    
                        // Insert order details
                        foreach ($data['dishes'] as $dish) {
                            $stmt = $pdo->prepare("
                                INSERT INTO order_details (
                                    order_id, 
                                    dish_id, 
                                    quantity, 
                                    preparation_status, 
                                    is_new,
                                    picked_up,
                                    added_at,
                                    updated_at
                                ) VALUES (?, ?, ?, 'pending', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            ");
                            $stmt->execute([
                                $orderId,
                                $dish['dish_id'],
                                $dish['quantity']
                            ]);
                        }
                    
                        // Record the order creation in order_updates
                        $stmt = $pdo->prepare("
                            INSERT INTO order_updates (
                                order_id, 
                                update_type, 
                                details
                            ) VALUES (?, 'status_change', ?)
                        ");
                        $details = json_encode([
                            'new_status' => 'processing',
                            'changed_by' => 'system',
                            'timestamp' => date('Y-m-d H:i:s')
                        ]);
                        $stmt->execute([$orderId, $details]);
                    
                        $pdo->commit();
                    
                        echo json_encode([
                            'success' => true,
                            'order_id' => $orderId,
                            'message' => 'Order created and set to processing'
                        ]);
                        break;
                    
case 'get_revenue_stats':
    $timeframe = $_GET['timeframe'] ?? 'day';
    $selected_date = $_GET['selected_date'] ?? null;
    
    switch($timeframe) {
        case 'year':
            $year = $selected_date ?? date('Y');
            $start_date = "$year-01-01";
            $end_date = "$year-12-31";
            $group_by = "DATE_FORMAT(created_at, '%Y-%m')";
            $date_format = '%M'; // Month name
            break;
            
        case 'month':
            if ($selected_date) {
                $start_date = $selected_date . '-01';
                $end_date = date('Y-m-t', strtotime($start_date));
            } else {
                $start_date = date('Y-m-01');
                $end_date = date('Y-m-t');
            }
            $group_by = "DATE(created_at)";
            $date_format = '%d %b'; // Day Month
            break;
            
        default: // day
            $start_date = date('Y-m-d');
            $end_date = date('Y-m-d 23:59:59');
            $group_by = "DATE_FORMAT(created_at, '%H:00')";
            $date_format = '%H:00'; // Hour
    }
    
    // Get chart data
    $stmt = $pdo->prepare("
        SELECT 
            DATE_FORMAT(created_at, ?) as label,
            COALESCE(SUM(total_amount), 0) as revenue,
            COUNT(*) as order_count
        FROM orders 
        WHERE created_at BETWEEN ? AND ?
        AND status = 'bill_generated'
        GROUP BY $group_by
        ORDER BY created_at ASC
    ");
    
    $stmt->execute([$date_format, $start_date, $end_date]);
    $chart_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get totals
    $stmt = $pdo->prepare("
        SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COUNT(*) as total_orders
        FROM orders 
        WHERE created_at BETWEEN ? AND ?
        AND status = 'bill_generated'
    ");
    
    $stmt->execute([$start_date, $end_date]);
    $totals = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Calculate average (avoid division by zero)
    $data_points_count = count($chart_data);
    $average_revenue = $data_points_count > 0 ? 
        $totals['total_revenue'] / $data_points_count : 0;
    
    echo json_encode([
        'success' => true,
        'total_revenue' => $totals['total_revenue'],
        'average_revenue' => $average_revenue,
        'total_orders' => $totals['total_orders'],
        'chart_data' => $chart_data
    ]);
    break;
   


        case 'get_bill_details':
            $data = json_decode(file_get_contents('php://input'), true);
            $orderId = $data['orderId'] ?? null;
            if (!$orderId) {
                throw new Exception('Order ID is required');
            }
        
            $stmt = $pdo->prepare("
                SELECT 
                    o.*,
                    rt.table_number,
                    GROUP_CONCAT(
                        CONCAT(
                            COALESCE(c.name, 'Other'), 
                            ': ', 
                            d.name, 
                            ' (', 
                            od.quantity, 
                            IF(od.is_new = 1, ' - NEW', ''), 
                            ' $', 
                            d.price, 
                            ')'
                        )
                        ORDER BY c.name 
                        SEPARATOR ' | '
                    ) as ordered_dishes
                FROM orders o
                JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
                LEFT JOIN order_details od ON o.id = od.order_id
                LEFT JOIN dishes d ON od.dish_id = d.id
                LEFT JOIN categories c ON d.category_id = c.id
               WHERE o.id = ? AND o.bill_generated = 1
                GROUP BY o.id, o.restaurant_table_id, o.customer_name, o.total_amount, o.status, o.phone_number, o.payment_method, rt.table_number, o.created_at
            ");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
            if (!$order) {
                throw new Exception('Bill not found or order not completed/billed');
            }
        
            echo json_encode([
                'success' => true,
                'data' => $order
            ]);
            break;
            case 'get_order_preparation_status':
                $orderId = $_GET['orderId'] ?? null;
                if (!$orderId) {
                    throw new Exception('Order ID is required');
                }
            
                $stmt = $pdo->prepare("
                    SELECT od.id, od.preparation_status
                    FROM order_details od
                    WHERE od.order_id = ?
                ");
                $stmt->execute([$orderId]);
                $dishes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
                echo json_encode([
                    'success' => true,
                    'data' => $dishes
                ]);
                break;
                case 'get_active_orders':
                    $query = "
                        SELECT 
                            o.id,
                            o.restaurant_table_id,
                            o.customer_name,
                            o.phone_number,
                            o.total_amount,
                            o.payment_method,
                            o.status,
                            o.created_at,
                            rt.table_number,
                            GROUP_CONCAT(
                                CONCAT(
                                    COALESCE(c.name, 'Other'), 
                                    ': ', 
                                    d.name, 
                                    ' (', 
                                    od.quantity, 
                                    IF(od.is_new = 1, ' - NEW', ''), 
                                    ', Status: ', 
                                    od.preparation_status,
                                    ', DetailId: ', 
                                    od.id,
                                    ')'
                                )
                                ORDER BY c.name 
                                SEPARATOR ' | '
                            ) as ordered_dishes
                        FROM orders o
                        JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
                        LEFT JOIN order_details od ON o.id = od.order_id
                        LEFT JOIN dishes d ON od.dish_id = d.id
                        LEFT JOIN categories c ON d.category_id = c.id
                        WHERE o.status != 'completed'
                        AND od.preparation_status = 'prepared'
                        AND od.picked_up = 0 -- Only include prepared dishes that haven't been picked up
                        GROUP BY 
                            o.id, 
                            rt.table_number, 
                            o.restaurant_table_id, 
                            o.customer_name, 
                            o.phone_number, 
                            o.total_amount, 
                            o.payment_method, 
                            o.status, 
                            o.created_at
                        HAVING ordered_dishes IS NOT NULL -- Ensures at least one prepared, non-picked dish exists
                        ORDER BY o.created_at DESC
                    ";
                    $stmt = $pdo->query($query);
                    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    echo json_encode([
                        'success' => true,
                        'data' => $orders
                    ]);
                    break;
                
                        case 'get_waiter_notification_count':
                            $stmt = $pdo->prepare("
                                SELECT COUNT(*)
                                FROM order_details od
                                JOIN orders o ON od.order_id = o.id
                                WHERE o.status != 'completed'
                                AND od.preparation_status = 'prepared'
                                AND od.picked_up = 0
                                AND od.pickup_notified = 0
                            ");
                            $stmt->execute();
                            $count = (int)$stmt->fetchColumn();
                        
                            echo json_encode([
                                'success' => true,
                                'count' => $count
                            ]);
                            break;
                            case 'get_waiter_notification_count':
                                $stmt = $pdo->prepare("
                                    SELECT COUNT(*)
                                    FROM order_details od
                                    JOIN orders o ON od.order_id = o.id
                                    WHERE o.status != 'completed'
                                    AND od.preparation_status = 'prepared'
                                    AND od.picked_up = 0
                                    AND od.pickup_notified = 0
                                ");
                                $stmt->execute();
                                $count = (int)$stmt->fetchColumn();
                            
                                echo json_encode([
                                    'success' => true,
                                    'count' => $count
                                ]);
                                break;
                                case 'mark_order_picked':
                                    $data = json_decode(file_get_contents('php://input'), true);
                                    $orderId = $data['orderId'] ?? null;
                                    if (!$orderId) {
                                        error_log("mark_order_picked: Order ID is missing");
                                        throw new Exception('Order ID is required');
                                    }
                                
                                    $pdo->beginTransaction();
                                
                                    try {
                                        // Get all prepared dishes for the order that haven't been picked up
                                        $stmt = $pdo->prepare("
                                            SELECT od.id, d.name AS dish_name
                                            FROM order_details od
                                            JOIN dishes d ON od.dish_id = d.id
                                            WHERE od.order_id = ?
                                            AND od.preparation_status = 'prepared'
                                            AND od.picked_up = 0
                                        ");
                                        $stmt->execute([$orderId]);
                                        $preparedDishes = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                        $preparedDetailIds = array_column($preparedDishes, 'id');
                                        $dishNames = array_column($preparedDishes, 'dish_name');
                                
                                        if (empty($preparedDetailIds)) {
                                            error_log("mark_order_picked: No prepared, non-picked dishes for order ID $orderId");
                                            throw new Exception('No prepared dishes to pick up');
                                        }
                                
                                        // Get the table number
                                        $stmt = $pdo->prepare("
                                            SELECT rt.table_number
                                            FROM orders o
                                            JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
                                            WHERE o.id = ?
                                        ");
                                        $stmt->execute([$orderId]);
                                        $tableNumber = $stmt->fetchColumn();
                                
                                        // Mark the prepared dishes as picked up, reset pickup_notified, and update the timestamp
                                        $stmt = $pdo->prepare("
                                            UPDATE order_details
                                            SET picked_up = 1,
                                                pickup_notified = 0,
                                                updated_at = CURRENT_TIMESTAMP
                                            WHERE id IN (" . implode(',', array_fill(0, count($preparedDetailIds), '?')) . ")
                                        ");
                                        $stmt->execute($preparedDetailIds);
                                
                                        $pdo->commit();
                                
                                        echo json_encode([
                                            'success' => true,
                                            'message' => 'Order marked as picked up',
                                            'dish_names' => $dishNames,
                                            'table_number' => $tableNumber
                                        ]);
                                    } catch (Exception $e) {
                                        $pdo->rollBack();
                                        error_log("mark_order_picked failed for order ID $orderId: " . $e->getMessage());
                                        throw $e;
                                    }
                                    break;
                                
                                case 'check_prepared_dishes':
                                    $data = json_decode(file_get_contents('php://input'), true);
                                    $lastCheck = $data['last_check'] ?? date('Y-m-d H:i:s', strtotime('-1 minute'));
                                
                                    // Fetch dish preparation events since last check that haven't been seen
                                    $stmt = $pdo->prepare("
                                        SELECT 
                                            ou.order_id,
                                            JSON_UNQUOTE(JSON_EXTRACT(ou.details, '$.detail_id')) as detail_id,
                                            d.name as dish_name,
                                            ou.id as update_id
                                        FROM order_updates ou
                                        JOIN order_details od ON ou.order_id = od.order_id AND JSON_UNQUOTE(JSON_EXTRACT(ou.details, '$.detail_id')) = od.id
                                        JOIN dishes d ON od.dish_id = d.id
                                        WHERE ou.update_type = 'dish_status_change'
                                        AND ou.created_at > ?
                                        AND ou.seen_by_waiter = 0
                                        ORDER BY ou.created_at ASC
                                    ");
                                    $stmt->execute([$lastCheck]);
                                    $preparedEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                    // Mark preparation notifications as seen
                                    foreach ($preparedEvents as $event) {
                                        $stmt = $pdo->prepare("UPDATE order_updates SET seen_by_waiter = 1 WHERE id = ?");
                                        $stmt->execute([$event['update_id']]);
                                    }
                                
                                    // Fetch orders with newly picked dishes since last check that haven't been notified
                                    $stmt = $pdo->prepare("
                                        SELECT DISTINCT od.order_id, rt.table_number,
                                            GROUP_CONCAT(d.name ORDER BY d.name SEPARATOR ', ') AS dish_names
                                        FROM order_details od
                                        JOIN orders o ON od.order_id = o.id
                                        JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
                                        JOIN dishes d ON od.dish_id = d.id
                                        WHERE od.picked_up = 1
                                        AND od.pickup_notified = 0
                                        AND od.updated_at > ?
                                        GROUP BY od.order_id, rt.table_number
                                    ");
                                    $stmt->execute([$lastCheck]);
                                    $pickedEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);
                                
                                    // Mark pickup notifications as seen
                                    foreach ($pickedEvents as $event) {
                                        $stmt = $pdo->prepare("
                                            UPDATE order_details
                                            SET pickup_notified = 1
                                            WHERE order_id = ? AND picked_up = 1
                                        ");
                                        $stmt->execute([$event['order_id']]);
                                    }
                                
                                    echo json_encode([
                                        'success' => true,
                                        'prepared_dishes' => $preparedEvents,
                                        'picked_orders' => $pickedEvents,
                                        'current_time' => date('Y-m-d H:i:s')
                                    ]);
                                    break;
                    

                        case 'get_chef_notification_count':
                            $stmt = $pdo->prepare("
                                SELECT COUNT(*)
                                FROM order_details od
                                JOIN orders o ON od.order_id = o.id
                                WHERE o.status != 'completed'
                                AND od.preparation_status = 'pending'
                            ");
                            $stmt->execute();
                            $count = (int)$stmt->fetchColumn();
                        
                            echo json_encode([
                                'success' => true,
                                'count' => $count
                            ]);
                            break;
                        case 'get_admin_active_orders':
                            $query = "
                                SELECT 
                                    o.id,
                                    o.restaurant_table_id,
                                    o.customer_name,
                                    o.phone_number,
                                    o.total_amount,
                                    o.payment_method,
                                    o.status,
                                    o.created_at,
                                    rt.table_number,
                                    GROUP_CONCAT(
                                        CONCAT(
                                            COALESCE(c.name, 'Other'), 
                                            ': ', 
                                            d.name, 
                                            ' (', 
                                            od.quantity, 
                                            IF(od.is_new = 1, ' - NEW', ''), 
                                            ', Status: ', 
                                            od.preparation_status,
                                            ', DetailId: ', 
                                            od.id,
                                            ', PickedUp: ',
                                            od.picked_up,
                                            ')'
                                        )
                                        ORDER BY c.name 
                                        SEPARATOR ' | '
                                    ) as ordered_dishes
                                FROM orders o
                                JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
                                LEFT JOIN order_details od ON o.id = od.order_id
                                LEFT JOIN dishes d ON od.dish_id = d.id
                                LEFT JOIN categories c ON d.category_id = c.id
                                WHERE o.status != 'completed'
                                GROUP BY 
                                    o.id, 
                                    rt.table_number, 
                                    o.restaurant_table_id, 
                                    o.customer_name, 
                                    o.phone_number, 
                                    o.total_amount, 
                                    o.payment_method, 
                                    o.status, 
                                    o.created_at
                                ORDER BY o.created_at DESC
                            ";
                            $stmt = $pdo->query($query);
                            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
                            echo json_encode([
                                'success' => true,
                                'data' => $orders
                            ]);
                            break;
             


                case 'get_chef_order_counts':
                    try {
                        // Processing: Orders with at least one dish where preparation_status = 'pending' and status != 'completed'
                        $stmt = $pdo->query("
                            SELECT COUNT(DISTINCT o.id)
                            FROM orders o
                            JOIN order_details od ON o.id = od.order_id
                            WHERE od.preparation_status = 'pending'
                            AND o.status != 'completed'
                        ");
                        $processingCount = (int)$stmt->fetchColumn();
                
                        // Prepared: Orders where all dishes are prepared (no pending dishes) and status != 'completed'
                        $stmt = $pdo->query("
                            SELECT COUNT(DISTINCT o.id)
                            FROM orders o
                            LEFT JOIN order_details od ON o.id = od.order_id AND od.preparation_status = 'pending'
                            WHERE o.status != 'completed'
                            AND od.id IS NULL
                        ");
                        $preparedCount = (int)$stmt->fetchColumn();
                
                        echo json_encode([
                            'success' => true,
                            'data' => [
                                'processingCount' => $processingCount,
                                'preparedCount' => $preparedCount
                            ]
                        ]);
                    } catch (Exception $e) {
                        http_response_code(500);
                        echo json_encode([
                            'success' => false,
                            'error' => $e->getMessage()
                        ]);
                    }
                    break;
                    case 'update_status':
                        $data = json_decode(file_get_contents('php://input'), true);
                        $orderId = $data['orderId'] ?? null;
                        $newStatus = $data['newStatus'] ?? null;
                    
                        if (!$orderId || !$newStatus) {
                            throw new Exception('Order ID and new status are required');
                        }
                    
                        $validStatuses = ['pending', 'processing', 'food_prepared', 'completed'];
                        if (!in_array($newStatus, $validStatuses)) {
                            throw new Exception('Invalid status');
                        }
                    
                        $pdo->beginTransaction();
                    
                        try {
                            // Update order status
                            $stmt = $pdo->prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
                            $stmt->execute([$newStatus, $orderId]);
                    
                            // Log the status change in order_updates
                            $stmt = $pdo->prepare("
                                INSERT INTO order_updates (
                                    order_id, 
                                    update_type, 
                                    details
                                ) VALUES (?, 'status_change', ?)
                            ");
                            $details = json_encode([
                                'new_status' => $newStatus,
                                'changed_by' => 'admin',
                                'timestamp' => date('Y-m-d H:i:s')
                            ]);
                            $stmt->execute([$orderId, $details]);
                    
                            // If the new status is 'completed', reset the table status to 'free'
                            if ($newStatus === 'completed') {
                                // Fetch the restaurant_table_id for the order
                                $stmt = $pdo->prepare("SELECT restaurant_table_id FROM orders WHERE id = ?");
                                $stmt->execute([$orderId]);
                                $tableId = $stmt->fetchColumn();
                    
                                if ($tableId) {
                                    // Reset the table status to 'free' and clear last_order_id
                                    $stmt = $pdo->prepare("
                                        UPDATE restaurant_tables 
                                        SET status = 'free', 
                                            last_order_id = NULL,
                                            updated_at = CURRENT_TIMESTAMP
                                        WHERE id = ?
                                    ");
                                    $stmt->execute([$tableId]);
                                } else {
                                    error_log("update_status: No table found for order ID $orderId");
                                }
                            }
                    
                            $pdo->commit();
                    
                            echo json_encode([
                                'success' => true,
                                'message' => 'Order status updated'
                            ]);
                        } catch (Exception $e) {
                            $pdo->rollBack();
                            error_log("update_status failed for order ID $orderId: " . $e->getMessage());
                            throw $e;
                        }
                        break;
        
    default:
    throw new Exception('Invalid action specified');
}
} catch (Exception $e) {
    error_log('Error in orders.php (get_completed): ' . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    error_log('Database error in orders.php (get_completed): ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred'
    ]);
}
?>