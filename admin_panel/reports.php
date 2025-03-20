<?php
header('Content-Type: application/json');
include '../db.php';

try {
    error_log("Received request for reports.php");
    error_log("GET parameters: " . print_r($_GET, true));

    $type = $_GET['type'] ?? '';
    $startDate = $_GET['start_date'] ?? '';
    $endDate = $_GET['end_date'] ?? '';
    $period = $_GET['period'] ?? '';
    $action = $_GET['action'] ?? '';

    if (empty($type) && $action !== 'export') {
        throw new Exception('Report type is required');
    }

    if ($action === 'export') {
        $type = $_GET['type'] ?? '';
        $format = $_GET['format'] ?? 'pdf';
        if (empty($type) || !in_array($format, ['pdf', 'csv'])) {
            throw new Exception('Invalid export parameters');
        }

        if ($format === 'pdf') {
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . $type . '_report.pdf"');
            // Placeholder: Replace with actual PDF generation (e.g., using FPDF)
            echo file_get_contents('sample.pdf');
            exit;
        } elseif ($format === 'csv') {
            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="' . $type . '_report.csv"');
            $output = fopen('php://output', 'w');
            fputcsv($output, ['Type', 'Date/Month', 'Orders', 'Revenue']); // Updated header
            $data = $type === 'daily' ? getDailyData($startDate, $endDate, $period) : getMonthlyData($startDate, $endDate, $period);
            foreach ($data as $row) {
                fputcsv($output, [$type === 'daily' ? 'Daily' : 'Monthly', $type === 'daily' ? $row['date'] : $row['month'], $row['total_orders'], $row['revenue']]);
            }
            fclose($output);
            exit;
        }
    }

    switch ($type) {
        case 'daily':
            $data = getDailyData($startDate, $endDate, $period);
            $summary = [
                'total_revenue' => array_sum(array_column($data, 'revenue')),
                'total_orders' => array_sum(array_column($data, 'total_orders')),
                'avg_daily_revenue' => count($data) > 0 ? array_sum(array_column($data, 'revenue')) / count($data) : 0,
                'period_start' => count($data) > 0 ? min(array_column($data, 'date')) : date('Y-m-d'),
                'period_end' => count($data) > 0 ? max(array_column($data, 'date')) : date('Y-m-d')
            ];
            echo json_encode(['success' => true, 'data' => $data, 'summary' => $summary]);
            break;

        case 'monthly':
            $data = getMonthlyData($startDate, $endDate, $period);
            echo json_encode(['success' => true, 'monthly_data' => $data]);
            break;

        default:
            throw new Exception('Invalid report type: ' . $type);
    }
} catch (Exception $e) {
    error_log("Reports error: " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} catch (PDOException $e) {
    error_log("Database error in reports.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error occurred']);
}

function getDailyData($startDate = '', $endDate = '', $period = '') {
    global $pdo;
    $query = "
        SELECT 
            DATE(created_at) AS date,
            COUNT(*) as total_orders,
            SUM(total_amount) AS revenue
        FROM orders 
        WHERE 1=1
    ";
    $params = [];
    if ($period === 'today') {
        $query .= " AND DATE(created_at) = CURDATE()";
    } elseif ($period === 'currentMonth') {
        $query .= " AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())";
    } elseif ($period === 'currentYear') {
        $query .= " AND YEAR(created_at) = YEAR(CURDATE())";
    } elseif ($startDate && $endDate) {
        $query .= " AND created_at >= ? AND created_at <= ?";
        $params = [$startDate, $endDate];
    } else {
        $query .= " AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)";
    }
    $query .= " GROUP BY DATE(created_at) ORDER BY date DESC";
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getMonthlyData($startDate = '', $endDate = '', $period = '') {
    global $pdo;
    $query = "
        SELECT 
            DATE_FORMAT(created_at, '%Y-%m') AS month,
            COUNT(*) as total_orders,
            SUM(total_amount) AS revenue
        FROM orders 
        WHERE 1=1
    ";
    $params = [];
    if ($period === 'currentMonth') {
        $query .= " AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())";
    } elseif ($period === 'currentYear') {
        $query .= " AND YEAR(created_at) = YEAR(CURDATE())";
    } elseif ($startDate && $endDate) {
        $query .= " AND created_at >= ? AND created_at <= ?";
        $params = [$startDate, $endDate];
    } else {
        $query .= " AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)";
    }
    $query .= " GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month DESC";
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
?>