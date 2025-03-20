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
                    c.*,
                    COUNT(d.id) as dish_count
                FROM categories c
                LEFT JOIN dishes d ON c.id = d.category_id
                GROUP BY c.id
                ORDER BY c.display_order, c.name
            ");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'get_active':
            $stmt = $pdo->query("
                SELECT id, name
                FROM categories
                WHERE is_active = 1
                ORDER BY display_order, name
            ");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'get':
            $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
            if (!$id) {
                throw new Exception('Invalid category ID');
            }

            $stmt = $pdo->prepare("SELECT * FROM categories WHERE id = ?");
            $stmt->execute([$id]);
            $category = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$category) {
                throw new Exception('Category not found');
            }
            
            echo json_encode($category);
            break;

        case 'add':
            if (!isset($data['name']) || trim($data['name']) === '') {
                throw new Exception('Category name is required');
            }

            $stmt = $pdo->prepare("
                INSERT INTO categories (
                    name, 
                    description, 
                    display_order, 
                    is_active
                ) VALUES (?, ?, ?, 1)
            ");
            
            $stmt->execute([
                trim($data['name']),
                trim($data['description'] ?? ''),
                intval($data['display_order'] ?? 0)
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Category added successfully',
                'id' => $pdo->lastInsertId()
            ]);
            break;

        case 'update':
            if (!isset($data['id']) || !isset($data['name']) || trim($data['name']) === '') {
                throw new Exception('Category ID and name are required');
            }

            $stmt = $pdo->prepare("
                UPDATE categories 
                SET 
                    name = ?,
                    description = ?,
                    display_order = ?
                WHERE id = ?
            ");
            
            $result = $stmt->execute([
                trim($data['name']),
                trim($data['description'] ?? ''),
                intval($data['display_order'] ?? 0),
                $data['id']
            ]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Category not found');
            }

            echo json_encode([
                'success' => true,
                'message' => 'Category updated successfully'
            ]);
            break;

        case 'toggle':
            if (!isset($data['id'])) {
                throw new Exception('Category ID is required');
            }

            $stmt = $pdo->prepare("
                UPDATE categories 
                SET is_active = ? 
                WHERE id = ?
            ");
            
            $result = $stmt->execute([
                $data['is_active'] ? 1 : 0,
                $data['id']
            ]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Category not found');
            }

            echo json_encode([
                'success' => true,
                'message' => 'Category status updated successfully'
            ]);
            break;

        case 'delete':
            if (!isset($data['id'])) {
                throw new Exception('Category ID is required');
            }

            // Begin transaction
            $pdo->beginTransaction();

            try {
                // Check if category has dishes
                $stmt = $pdo->prepare("
                    SELECT COUNT(*) 
                    FROM dishes 
                    WHERE category_id = ?
                ");
                $stmt->execute([$data['id']]);
                $dishCount = $stmt->fetchColumn();

                if ($dishCount > 0) {
                    throw new Exception('Cannot delete category with existing dishes. Please remove or reassign dishes first.');
                }

                // Delete the category
                $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
                $stmt->execute([$data['id']]);

                if ($stmt->rowCount() === 0) {
                    throw new Exception('Category not found');
                }

                $pdo->commit();
                echo json_encode([
                    'success' => true,
                    'message' => 'Category deleted successfully'
                ]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
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