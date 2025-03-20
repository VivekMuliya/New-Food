<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Set headers for SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

// Allow the script to run indefinitely
set_time_limit(0);

// Include database connection
try {
    require_once '../db.php';
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }
} catch (Exception $e) {
    error_log('Database connection error: ' . $e->getMessage());
    echo "data: " . json_encode(['error' => 'Database connection failed']) . "\n\n";
    ob_flush();
    flush();
    exit;
}

// Get the last event ID (if provided by the client)
$lastEventId = isset($_SERVER['HTTP_LAST_EVENT_ID']) ? (int)$_SERVER['HTTP_LAST_EVENT_ID'] : (strtotime(date('Y-m-d H:i:s', strtotime('-1 minute'))) * 1000);

// Main SSE loop
while (true) {
    try {
        // Check if updated_at column exists
        $columns = $pdo->query("SHOW COLUMNS FROM orders LIKE 'updated_at'")->fetchAll();
        $updateTimeColumn = !empty($columns) ? 'o.updated_at' : 'o.created_at';

        // Fetch orders updated since last_check
        $query = "
            SELECT DISTINCT
                o.id as order_id,
                o.status,
                o.customer_name,
                o.restaurant_table_id,
                rt.table_number,
                o.total_amount,
                o.created_at,
                " . $updateTimeColumn . " as updated_at
            FROM orders o
            JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
            WHERE " . $updateTimeColumn . " > FROM_UNIXTIME(:lastEventId1 / 1000)
            OR EXISTS (
                SELECT 1 
                FROM order_updates ou 
                WHERE ou.order_id = o.id 
                AND ou.created_at > FROM_UNIXTIME(:lastEventId2 / 1000)
            )
            ORDER BY " . $updateTimeColumn . " DESC
        ";
        
        $stmt = $pdo->prepare($query);
        // Bind the same lastEventId to both placeholders
        $stmt->execute([
            'lastEventId1' => $lastEventId,
            'lastEventId2' => $lastEventId
        ]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get dishes for each order with preparation status
        foreach ($orders as &$order) {
            $dishQuery = "
                SELECT 
                    d.name,
                    od.quantity,
                    od.preparation_status,
                    od.is_new
                FROM order_details od
                JOIN dishes d ON od.dish_id = d.id
                WHERE od.order_id = ?
            ";
            $dishStmt = $pdo->prepare($dishQuery);
            $dishStmt->execute([$order['order_id']]);
            $dishes = $dishStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $order['dishes'] = $dishes;
            $order['ordered_dishes'] = array_map(function($dish) {
                return $dish['name'] . ' (' . $dish['quantity'] . ')';
            }, $dishes);
            $order['ordered_dishes'] = implode(', ', $order['ordered_dishes']);
        }

        if (!empty($orders)) {
            foreach ($orders as $order) {
                $data = json_encode($order);
                echo "id: " . (strtotime($order['updated_at']) * 1000) . "\n";
                echo "data: $data\n\n";
                ob_flush();
                flush();
                // Update lastEventId to the latest update's timestamp
                $lastEventId = strtotime($order['updated_at']) * 1000;
            }
        } else {
            // Send a heartbeat to keep the connection alive
            echo "data: {}\n\n";
            ob_flush();
            flush();
        }
    } catch (Exception $e) {
        // Log the error and send an SSE error message
        error_log('SSE error: ' . $e->getMessage());
        echo "data: " . json_encode(['error' => $e->getMessage()]) . "\n\n";
        ob_flush();
        flush();
        break; // Exit the loop on error
    }

    // Sleep for a short interval to prevent excessive CPU usage
    sleep(2);
}
?>