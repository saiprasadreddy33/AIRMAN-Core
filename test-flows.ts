import fs from 'fs';

async function fetchApi(path: string, method = 'GET', body?: any, token?: string) {
  const url = `http://localhost:3001${path}`;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }

  return { status: response.status, data };
}

async function run() {
  console.log('\n=======================================');
  console.log('1. STUDENT FLOW');
  console.log('=======================================');

  console.log('-> POST /auth/login (Student A)');
  const loginRes = await fetchApi('/auth/login', 'POST', {
    email: 'studenta@test.com',
    password: 'password'
  });
  console.log(`Status: ${loginRes.status}`);
  const token = loginRes.data?.accessToken;
  if (!token) throw new Error('Failed to get token');

  console.log('\n-> GET /courses?page=1&limit=2');
  const courseRes = await fetchApi('/courses?page=1&limit=2', 'GET', undefined, token);
  console.log(`Status: ${courseRes.status}, Data:`, JSON.stringify(courseRes.data, null, 2));

  const courseId = courseRes.data?.data?.[0]?.id;
  if (!courseId) throw new Error('No course found');

  console.log(`\n-> GET /courses/${courseId}/modules?page=1&limit=2`);
  const modRes = await fetchApi(`/courses/${courseId}/modules?page=1&limit=2`, 'GET', undefined, token);
  console.log(`Status: ${modRes.status}, Data:`, JSON.stringify(modRes.data, null, 2));

  // The database seed creates LearningModules but GET /courses/:id/modules doesn't return lessons nested unless mapped.
  // We need the lessonId from somewhere. Let's just query the db via prisma temporarily just to get IDs for the test.
  // We'll skip that and just fetch the lesson ID via standard querying if we had the endpoint.
  // Wait, I can just use prisma in this script to fetch the Seeded Lesson.
}

run();
