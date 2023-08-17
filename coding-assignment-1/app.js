const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const format = require("date-fns/format");
const isValid = require("date-fns/isValid");
const toDate = require("date-fns/toDate");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "todoApplication.db");

let db = null;

const initializeDbServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        app.listen(3000, ()=> {
            console.log("DataBase Connected");
        });
    }
    catch (e) {
        console.log(`DB Error: ${e,message}`);
        process.exit(1);
    }
};
initializeDbServer();

const checkRequestsQueries = async (request, response, next) => {
    const { search_q, priority, status, category, date } = request.query;
    const { todoId } = request.params;
    if(category !== undefined) {
        const categoryArray = ["WORK", "HOME", "LEARNING"];
        const categoryIsInArray = categoryArray.includes(category);
        if(categoryIsInArray === true) {
            request.category = category;
        }
        else {
            response.status(400);
            response.send("Invalid Todo Category");
            return;
        }
    }

    if(status !== undefined) {
        const statusArray = ["TO DO", "IN PROGRESS", "DONE"];
        const statusIsInArray = statusArray.includes(status);
        if(statusIsInArray === true) {
            request.status = status;
        }
        else {
            response.status(400);
            response.send("Invalid Todo Status");
            return;
        }
    };

    if(priority !== undefined) {
        const priorityArray = ["HIGH", "MEDIUM", "LOW"];
        const priorityIsInArray = priorityArray.includes(priority);
        if(priorityIsInArray === true) {
            request.priority = priority;
        }
        else {
            response.status(400);
            response.send("Invalid Todo Priority");
            return;
        }
    };

    if (date !== undefined) {
        try {
            const myDate = new Date(date);

            const formatedDate = format(new Date(date), "yyyy-MM-dd");
            console.log(formatedDate, "f");
            const result = toDate(
                new Date(
                    `${myDate.getFullYear()}-${myDate.getMonth() + 1}-${myDate.getDate()}`
                )
            );
            console.log(result,"r");
            console.log(new Date(), "new");

            const isValidDate = await isValid(result);
            console.log(isValidDate, "V");
            if(isValidDate === true) {
                request.date = formatedDate;
            }
            else {
                response.status(400);
                response.send("Invalid Due Date");
                return;
            }
        }
        catch (e) {
            response.status(400);
            response.send("Invalid Due Date");
            return;
        }
    }

    request.todoId = todoId;
    request.search_q = search_q;

    next();
};

const checkRequestsBody = async (request, response, next) => {
    const {id, todo, category, priority, status, dueDate} = request.body;
    const { todoId } = request.params;

    if(category !== undefined) {
        const categoryArray = ["WORK", "HOME", "LEARNING"];
        const categoryIsInArray = categoryArray.includes(category);
        if(categoryIsInArray === true) {
            request.category = category;
        }
        else {
            response.status(400);
            response.send("Invalid Todo Category");
            return;
        }
    }

    if(status !== undefined) {
        const statusArray = ["TO DO", "IN PROGRESS", "DONE"];
        const statusIsInArray = statusArray.includes(status);
        if(statusIsInArray === true) {
            request.status = status;
        }
        else {
            response.status(400);
            response.send("Invalid Todo Status");
            return;
        }
    };

    if(priority !== undefined) {
        const priorityArray = ["HIGH", "MEDIUM", "LOW"];
        const priorityIsInArray = priorityArray.includes(priority);
        if(priorityIsInArray === true) {
            request.priority = priority;
        }
        else {
            response.status(400);
            response.send("Invalid Todo Priority");
            return;
        }
    };

    if (dueDate !== undefined) {
        try {
            const myDate = new Date(dueDate);
            const formatedDate = format(new Date(dueDate), "yyyy-MM-dd");
            console.log(formatedDate);
            const result = toDate(new Date(formatedDate));
            const isValidDate = isValid(result);
            console.log(isValidDate);
            if(isValidDate === true) {
                request.dueDate = formatedDate;
            }
            else {
                response.status(400);
                response.send("Invalid Due Date");
                return;
            }
        }
        catch (e) {
            response.status(400);
            response.send("Invalid Due Date");
            return;
        }
    }
    request.todoId = todoId;
    request.todo = todo;
    request.id = id;

    next();
}

//API 1
app.get("/todos/", checkRequestsQueries ,async (request, response) => {
    const {search_q = "", priority = "", status = "", category =""} = request;
    // console.log(search_q, priority, status, category);
    let getTodosQuery = `
    SELECT id,todo,priority,status,category,due_date as dueDate
    FROM todo
    WHERE 
        todo like '%${search_q}%' 
    and priority like '%${priority}%'
    and status like '%${status}%'
    and category like '%${category}%'
    `;
    const todoItem = await db.all(getTodosQuery);
    response.send(todoItem);
});

//API 2
app.get("/todos/:todoId/", checkRequestsQueries, async (request, response) => {
    const { todoId } = request;
    const getTodoQuery = `
    SELECT
        id,
        todo,
        priority,
        status,
        category,
        due_date as dueDate
    FROM
        todo
    where
        id = ${todoId};
    `;
    const todo = await db.get(getTodoQuery);
    response.send(todo);
});

//API 3
app.get("/agenda/", checkRequestsQueries, async (request, response) => {
    const { date } = request;
    console.log(date, "a");

    const selectDueDateQuery = `
    SELECT
        id,
        todo,
        priority,
        status,
        category,
        due_date as dueDate
    FROM
        todo
    WHERE
        due_date = '${date}';
    `;
    console.log(selectDueDateQuery);
    const todosArray = await db.all(selectDueDateQuery);
    console.log(todosArray);

    if(todosArray === undefined) {
        response.status(400);
        response.send("Invalid Due Date");
    }
    else {
        response.send(todosArray);
    }
});

//API 4
app.post("/todos/", checkRequestsBody ,async (request, response) => {
    const {id, todo, priority, status, category, dueDate} = request;
    const insertTodoQuery = `
    INSERT into 
        todo (id, todo, priority, status, category, due_date)
    VALUES
        (
            ${id},
            '${todo}',
            '${priority}',
            '${status}',
            '${category}',
            '${dueDate}'
        );
    `;
    const createUser = await db.run(insertTodoQuery);
    console.log(insertTodoQuery);
    response.send("Todo Successfully Added");
});

//API 5
app.put("/todos/:todoId/", checkRequestsBody, async (request, response) => {
    const { todoId } = request;
    const {id, todo, priority, status, category, dueDate} = request;

    let updateTodoQuery = null;

    switch(true) {
        case status !== undefined:
            updateTodoQuery = `
                UPDATE
                    todo
                SET
                    status = '${status}'
                WHERE
                    id = ${todoId};
            `;
            await db.run(updateTodoQuery);
            response.send("Status Updated");
            break;
        
        case priority !== undefined:
            updateTodoQuery = `
                UPDATE
                    todo
                SET
                    priority = '${priority}'
                WHERE
                    id = ${todoId};
            `;
            await db.run(updateTodoQuery);
            response.send("Priority Updated");
            break;

        case todo !== undefined:
            updateTodoQuery = `
                UPDATE
                    todo
                SET
                    todo = '${todo}'
                WHERE
                    id = ${todoId};
            `;
            await db.run(updateTodoQuery);
            response.send("Todo Updated");
            break;
        
        case category !== undefined:
            updateTodoQuery = `
                UPDATE
                    todo
                SET
                    category = '${category}'
                WHERE
                    id = ${todoId};
            `;
            await db.run(updateTodoQuery);
            response.send("Category Updated");
            break;
        
        case dueDate !== undefined:
            updateTodoQuery = `
                UPDATE
                    todo
                SET
                    due_date = '${dueDate}'
                WHERE
                    id = ${todoId};
            `;
            await db.run(updateTodoQuery);
            response.send("Due Date Updated");
            break;
    }
});

//API 6
app.delete("/todos/:todoId/", async (request, response) => {
    const { todoId } = request.params;
    const deleteTodoQuery = `
    DELETE FROM 
        todo
    WHERE
        id = ${todoId};
    `;
    await db.run(deleteTodoQuery);
    response.send("Todo Deleted");
});

module.exports = app;