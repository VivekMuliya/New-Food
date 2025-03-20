<?php
// manage_tables.php
header('Content-Type: application/json');
include '../db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    switch ($action) {
        case 'add':
            $stmt = $pdo->prepare("
                SELECT MAX(table_number) as max_number 
                FROM restaurant_tables
            ");
            $stmt->execute();
            $result = $stmt->fetch();
            $newTableNumber = ($result['max_number'] ?? 0) + 1;

            $stmt = $pdo->prepare("
                INSERT INTO restaurant_tables (
                    table_number, capacity, status
                ) VALUES (?, ?, 'free')
            ");
            $stmt->execute([$newTableNumber, $data['capacity']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Table added successfully'
            ]);
            break;

        case 'update':
            $stmt = $pdo->prepare("
                UPDATE restaurant_tables 
                SET capacity = ?
                WHERE id = ? AND status = 'free'
            ");
            $stmt->execute([$data['capacity'], $data['id']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Table updated successfully'
            ]);
            break;

        case 'delete':
            $stmt = $pdo->prepare("
                DELETE FROM restaurant_tables 
                WHERE id = ? AND status = 'free'
            ");
            $stmt->execute([$data['id']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Table deleted successfully'
            ]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>