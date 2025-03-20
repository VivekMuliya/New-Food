<?php
header('Content-Type: application/json');
include '../db.php';

try {
    // Get filter parameters
    $categoryId = isset($_GET['category']) ? filter_var($_GET['category'], FILTER_VALIDATE_INT) : null;
    $showAll = isset($_GET['show_all']) && $_GET['show_all'] === 'true';
    
    // Build the base query - removed display_order from selection
    $query = "
        SELECT 
            d.id,
            d.name AS dish_name,
            d.description,
            d.price,
            d.image_url,
            d.is_available,
            d.category_id,
            c.name AS category_name,
            c.description AS category_description
        FROM 
            dishes d
        LEFT JOIN 
            categories c ON d.category_id = c.id
        WHERE 1=1
    ";

    // Add filters
    if (!$showAll) {
        $query .= " AND d.is_available = 1 AND (c.is_active = 1 OR c.is_active IS NULL)";
    }
    if ($categoryId) {
        $query .= " AND d.category_id = :category_id";
    }

    // Update ordering to use category name and dish name only
    $query .= " ORDER BY c.name, d.name";

    // Prepare and execute the query
    $stmt = $pdo->prepare($query);
    if ($categoryId) {
        $stmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
    }
    $stmt->execute();
    $dishes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group dishes by category
    $groupedDishes = [];
    foreach ($dishes as $dish) {
        $categoryId = $dish['category_id'] ?? 'uncategorized';
        
        // Initialize category group if not exists - removed display_order
        if (!isset($groupedDishes[$categoryId])) {
            $groupedDishes[$categoryId] = [
                'category_id' => $dish['category_id'],
                'category_name' => $dish['category_name'] ?? 'Uncategorized',
                'category_description' => $dish['category_description'],
                'dishes' => []
            ];
        }
        
        // Add dish to its category group
        $groupedDishes[$categoryId]['dishes'][] = [
            'id' => $dish['id'],
            'name' => $dish['dish_name'],
            'description' => $dish['description'],
            'price' => floatval($dish['price']),
            'image_url' => $dish['image_url'],
            'is_available' => (bool)$dish['is_available']
        ];
    }

    // Sort categories by name instead of display_order
    ksort($groupedDishes);

    // Include category statistics if requested
    $stats = null;
    if (isset($_GET['include_stats']) && $_GET['include_stats'] === 'true') {
        $statsQuery = "
            SELECT 
                COUNT(DISTINCT d.id) as total_dishes,
                COUNT(DISTINCT d.category_id) as total_categories,
                COUNT(DISTINCT CASE WHEN d.is_available = 1 THEN d.id END) as available_dishes
            FROM dishes d
        ";
        $statsStmt = $pdo->query($statsQuery);
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
    }

    // Build response
    $response = [
        'success' => true,
        'data' => array_values($groupedDishes)
    ];

    if ($stats) {
        $response['stats'] = $stats;
    }

    echo json_encode($response, JSON_NUMERIC_CHECK);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error occurred',
        'details' => $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>