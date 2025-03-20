<?php
header('Content-Type: application/json');
include '../db.php';

// Get JSON input for POST requests
$jsonInput = file_get_contents('php://input');
$data = json_decode($jsonInput, true);

$action = $_GET['action'] ?? '';

try {
    switch($action) {
        case 'get_all':
            $stmt = $pdo->query("
                SELECT 
                    d.*,
                    c.name as category_name
                FROM dishes d
                LEFT JOIN categories c ON d.category_id = c.id
                ORDER BY c.name, d.name"  // Removed display_order
            );
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'get':
            $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
            if (!$id) {
                throw new Exception('Invalid dish ID');
            }

            $stmt = $pdo->prepare("
                SELECT 
                    d.*,
                    c.name as category_name
                FROM dishes d
                LEFT JOIN categories c ON d.category_id = c.id
                WHERE d.id = ?
            ");
            $stmt->execute([$id]);
            $dish = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$dish) {
                throw new Exception('Dish not found');
            }
            
            echo json_encode($dish);
            break;

        case 'add':
            if (!isset($data['name']) || trim($data['name']) === '') {
                throw new Exception('Dish name is required');
            }
            if (!isset($data['price']) || !is_numeric($data['price']) || $data['price'] <= 0) {
                throw new Exception('Valid price is required');
            }
            if (!isset($data['category_id']) || !is_numeric($data['category_id'])) {
                throw new Exception('Valid category is required');
            }

            // Verify category exists
            $stmt = $pdo->prepare("SELECT id FROM categories WHERE id = ?");
            $stmt->execute([$data['category_id']]);
            if (!$stmt->fetch()) {
                throw new Exception('Selected category does not exist');
            }

            $stmt = $pdo->prepare("
                INSERT INTO dishes (
                    name,
                    category_id,
                    description,
                    price,
                    is_available,
                    image_url
                ) VALUES (?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                trim($data['name']),
                $data['category_id'],
                trim($data['description'] ?? ''),
                $data['price'],
                isset($data['is_available']) ? 1 : 0,
                $data['image_url'] ?? null
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Dish added successfully',
                'id' => $pdo->lastInsertId()
            ]);
            break;

        case 'update':
            if (!isset($data['id']) || !is_numeric($data['id'])) {
                throw new Exception('Valid dish ID is required');
            }
            if (!isset($data['name']) || trim($data['name']) === '') {
                throw new Exception('Dish name is required');
            }
            if (!isset($data['price']) || !is_numeric($data['price']) || $data['price'] <= 0) {
                throw new Exception('Valid price is required');
            }
            if (!isset($data['category_id']) || !is_numeric($data['category_id'])) {
                throw new Exception('Valid category is required');
            }

            // Verify category exists
            $stmt = $pdo->prepare("SELECT id FROM categories WHERE id = ?");
            $stmt->execute([$data['category_id']]);
            if (!$stmt->fetch()) {
                throw new Exception('Selected category does not exist');
            }

            $stmt = $pdo->prepare("
                UPDATE dishes 
                SET 
                    name = ?,
                    category_id = ?,
                    description = ?,
                    price = ?,
                    is_available = ?,
                    image_url = ?
                WHERE id = ?
            ");
            
            $result = $stmt->execute([
                trim($data['name']),
                $data['category_id'],
                trim($data['description'] ?? ''),
                $data['price'],
                isset($data['is_available']) ? 1 : 0,
                $data['image_url'] ?? null,
                $data['id']
            ]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Dish not found or no changes made');
            }

            echo json_encode([
                'success' => true,
                'message' => 'Dish updated successfully'
            ]);
            break;

        case 'toggle_availability':
            if (!isset($data['id']) || !isset($data['is_available'])) {
                throw new Exception('Dish ID and availability status are required');
            }

            $stmt = $pdo->prepare("
                UPDATE dishes 
                SET is_available = ? 
                WHERE id = ?
            ");
            
            $result = $stmt->execute([
                $data['is_available'] ? 1 : 0,
                $data['id']
            ]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Dish not found');
            }

            echo json_encode([
                'success' => true,
                'message' => 'Dish availability updated successfully'
            ]);
            break;

        case 'delete':
            if (!isset($data['id'])) {
                throw new Exception('Dish ID is required');
            }

            // Begin transaction
            $pdo->beginTransaction();

            try {
                // Check if dish is in any active orders
                $stmt = $pdo->prepare("
                    SELECT COUNT(*) 
                    FROM order_details od
                    JOIN orders o ON od.order_id = o.id
                    WHERE od.dish_id = ? AND o.status = 'pending'
                ");
                $stmt->execute([$data['id']]);
                $orderCount = $stmt->fetchColumn();

                if ($orderCount > 0) {
                    throw new Exception('Cannot delete dish that has pending orders');
                }

                // Delete the dish
                $stmt = $pdo->prepare("DELETE FROM dishes WHERE id = ?");
                $stmt->execute([$data['id']]);

                if ($stmt->rowCount() === 0) {
                    throw new Exception('Dish not found');
                }

                $pdo->commit();
                echo json_encode([
                    'success' => true,
                    'message' => 'Dish deleted successfully'
                ]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;

        case 'get_by_category':
            $categoryId = filter_var($_GET['category_id'], FILTER_VALIDATE_INT);
            if (!$categoryId) {
                throw new Exception('Invalid category ID');
            }

            $stmt = $pdo->prepare("
                SELECT 
                    d.*,
                    c.name as category_name
                FROM dishes d
                LEFT JOIN categories c ON d.category_id = c.id
                WHERE d.category_id = ?
                ORDER BY d.name
            ");
            $stmt->execute([$categoryId]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
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
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred'
    ]);
}
?>