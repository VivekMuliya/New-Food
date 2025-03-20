<?php
header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);
include '../db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        throw new Exception('Invalid JSON data received');
    }

    $pdo->beginTransaction();

    if (isset($data['orderId']) && !empty($data['orderId'])) {
        // Updating an existing order
        $orderId = $data['orderId'];

        // Verify order exists and is not completed or bill_generated
        $stmt = $pdo->prepare("SELECT status FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $orderStatus = $stmt->fetchColumn();
        if (!$orderStatus || in_array($orderStatus, ['completed', 'bill_generated'])) {
            throw new Exception('Order not found or already completed/billed');
        }

        // Update total_amount and status
        $newStatus = $data['status'] ?? $orderStatus; // Use client status or retain current
        $stmt = $pdo->prepare("
            UPDATE orders 
            SET total_amount = total_amount + ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([$data['totalAmount'], $newStatus, $orderId]);

        // Insert new order details with the new status
        $stmt = $pdo->prepare("
            INSERT INTO order_details (
                order_id,
                dish_id,
                quantity,
                status,
                preparation_status,
                is_new
            ) VALUES (?, ?, ?, ?, 'pending', 1)
        ");
        foreach ($data['dishes'] as $dish) {
            $stmt->execute([
                $orderId,
                $dish['dishId'],
                $dish['quantity'],
                $newStatus
            ]);
        }

        // Log update in order_updates
        $stmt = $pdo->prepare("
            INSERT INTO order_updates (order_id, update_type, details)
            VALUES (?, 'dishes_added', ?)
        ");
        $details = json_encode([
            'added_dishes' => $data['dishes'],
            'total_amount_added' => $data['totalAmount'],
            'new_status' => $newStatus,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        $stmt->execute([$orderId, $details]);

        $response = [
            'success' => true,
            'message' => 'Dishes added to order successfully',
            'order_id' => $orderId
        ];
    } else {
        // Creating a new order
        if (empty($data['tableId']) || 
            empty($data['customerName']) || 
            empty($data['phoneNumber']) || 
            empty($data['dishes']) || 
            empty($data['totalAmount']) || 
            empty($data['paymentMethod'])) {
            throw new Exception('Missing required fields');
        }

        // Update table status
        $stmt = $pdo->prepare("
            UPDATE restaurant_tables 
            SET status = 'booked' 
            WHERE id = ?
        ");
        $stmt->execute([$data['tableId']]);

        // Insert new order
        $newStatus = $data['status'] ?? 'processing'; // Respect client status, default to 'processing'
        $stmt = $pdo->prepare("
            INSERT INTO orders (
                restaurant_table_id,
                customer_name,
                phone_number,
                total_amount,
                payment_method,
                status,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ");
        $stmt->execute([
            $data['tableId'],
            $data['customerName'],
            $data['phoneNumber'],
            $data['totalAmount'],
            $data['paymentMethod'],
            $newStatus
        ]);
        $orderId = $pdo->lastInsertId();

        // Update table's last_order_id
        $stmt = $pdo->prepare("
            UPDATE restaurant_tables 
            SET last_order_id = ? 
            WHERE id = ?
        ");
        $stmt->execute([$orderId, $data['tableId']]);

        // Insert order details
        $stmt = $pdo->prepare("
            INSERT INTO order_details (
                order_id,
                dish_id,
                quantity,
                status,
                preparation_status,
                is_new
            ) VALUES (?, ?, ?, ?, 'pending', 0)
        ");
        foreach ($data['dishes'] as $dish) {
            $stmt->execute([$orderId, $dish['dishId'], $dish['quantity'], $newStatus]);
        }

        $response = [
            'success' => true,
            'message' => 'Order placed successfully',
            'order_id' => $orderId
        ];
    }

    $pdo->commit();
    echo json_encode($response);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred: ' . $e->getMessage()
    ]);
}
?>