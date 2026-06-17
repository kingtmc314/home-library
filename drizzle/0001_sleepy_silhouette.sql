CREATE TABLE `books` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isbn` varchar(20),
	`title` varchar(512) NOT NULL,
	`authors` text,
	`coverUrl` text,
	`publisher` varchar(255),
	`publishedYear` varchar(10),
	`genre` varchar(128),
	`description` text,
	`pageCount` int,
	`language` varchar(64),
	`purchasePrice` decimal(10,2),
	`shelfLocationId` int,
	`dateAdded` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `books_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shelf_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shelf_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `books` ADD CONSTRAINT `books_shelfLocationId_shelf_locations_id_fk` FOREIGN KEY (`shelfLocationId`) REFERENCES `shelf_locations`(`id`) ON DELETE set null ON UPDATE no action;