<?php
include '../db.php';

$stmt = $pdo->query("
    SELECT MONTH(created_at) as month, COUNT(*) as total_orders, SUM(total_amount) as total_sales 
    FROM orders 
    WHERE status = 'completed' 
    GROUP BY MONTH(created_at)
");
echo json_encode($stmt->fetchAll());
?>
