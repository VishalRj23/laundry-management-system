CREATE DATABASE laundry;
USE laundry;

-- 1. Students (identified by floor + page_no)
CREATE TABLE Students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    floor_no INT NOT NULL,
    page_no INT NOT NULL,
    UNIQUE(floor_no, page_no) -- each page per floor unique
);

-- 2. Laundry_Items (types of clothes)
CREATE TABLE Laundry_Items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(50) NOT NULL
);

-- 3. Laundry_Records (one record per laundry submission)
CREATE TABLE Laundry_Records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    date_given DATE NOT NULL,
    total_clothes INT NOT NULL,
    is_collected BOOLEAN DEFAULT FALSE, -- tick when collected
    FOREIGN KEY (student_id) REFERENCES Students(student_id)
);

-- 4. Laundry_Record_Details (clothes breakdown)
CREATE TABLE Laundry_Record_Details (
    detail_id INT AUTO_INCREMENT PRIMARY KEY,
    record_id INT,
    item_id INT,
    quantity INT CHECK (quantity >= 0),
    FOREIGN KEY (record_id) REFERENCES Laundry_Records(record_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES Laundry_Items(item_id)
);


DELIMITER //


-- Procedure: Confirm Collection (tick mark)
CREATE PROCEDURE ConfirmCollection(
    IN p_floor INT,
    IN p_page INT
)
BEGIN
    DECLARE s_id INT;
    DECLARE r_id INT;

    -- Find student
    SELECT student_id INTO s_id
    FROM Students
    WHERE floor_no = p_floor AND page_no = p_page;

    -- Find last record
    SELECT record_id INTO r_id
    FROM Laundry_Records
    WHERE student_id = s_id
    ORDER BY date_given DESC
    LIMIT 1;

    -- Mark as collected
    UPDATE Laundry_Records
    SET is_collected = TRUE
    WHERE record_id = r_id;
END;
//

-- Procedure: Get Last Laundry Record
CREATE PROCEDURE GetLastLaundry(
    IN p_floor INT,
    IN p_page INT
)
BEGIN
    SELECT r.record_id, r.date_given, r.total_clothes, r.is_collected,
           li.item_name, d.quantity
    FROM Students s
    JOIN Laundry_Records r ON s.student_id = r.student_id
    JOIN Laundry_Record_Details d ON r.record_id = d.record_id
    JOIN Laundry_Items li ON d.item_id = li.item_id
    WHERE s.floor_no = p_floor AND s.page_no = p_page
    ORDER BY r.date_given DESC
    LIMIT 1;
END;
//
DELIMITER ;


-- View: All Records Date-wise
CREATE VIEW LaundryHistory AS
SELECT s.name, s.floor_no, s.page_no,
       r.date_given, r.total_clothes, r.is_collected
FROM Laundry_Records r
JOIN Students s ON r.student_id = s.student_id
ORDER BY r.date_given DESC;

-- View: Pending Collections
CREATE VIEW PendingCollections AS
SELECT s.name, s.floor_no, s.page_no,
       r.date_given, r.total_clothes
FROM Laundry_Records r
JOIN Students s ON r.student_id = s.student_id
WHERE r.is_collected = FALSE;


DROP PROCEDURE IF EXISTS GiveClothes;



DELIMITER $$

CREATE PROCEDURE GiveClothes(
    IN p_floor INT,
    IN p_page INT,
    IN p_item_id INT,
    IN p_quantity INT
)
BEGIN
    DECLARE s_id INT;
    DECLARE new_record_id INT;

    -- Find student
    SELECT student_id INTO s_id
    FROM Students
    WHERE floor_no = p_floor AND page_no = p_page;

    -- If no student found → throw error
    IF s_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Student not found!';
    END IF;

    -- Create new laundry record with is_collected = FALSE
    INSERT INTO Laundry_Records(student_id, date_given, total_clothes, is_collected)
    VALUES(s_id, CURDATE(), p_quantity, FALSE);

    SET new_record_id = LAST_INSERT_ID();

    -- Add details
    INSERT INTO Laundry_Record_Details(record_id, item_id, quantity)
    VALUES(new_record_id, p_item_id, p_quantity);
END$$

DELIMITER ;
