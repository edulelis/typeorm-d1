import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Test entities for testing TypeORM D1 driver
 */

// Simple entity for basic CRUD tests
@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  age?: number;

  @Column({ default: true })
  active!: boolean;

  @OneToMany(() => Post, (post) => post.author)
  posts!: Post[];

  @OneToOne(() => Profile, (profile: any) => profile.user)
  profile?: any; // Use 'any' to avoid circular reference, decorator handles the type

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// Entity for testing relations - OneToMany/ManyToOne
@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: "text", nullable: true })
  content?: string;

  @Column()
  authorId!: number;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: "CASCADE" })
  author!: User;

  @ManyToMany(() => Tag, (tag) => tag.posts)
  @JoinTable({
    name: "post_tags",
    joinColumn: { name: "postId", referencedColumnName: "id" },
    inverseJoinColumn: { name: "tagId", referencedColumnName: "id" },
  })
  tags!: Tag[];

  @CreateDateColumn()
  createdAt!: Date;
}

// Entity for testing ManyToMany relations
@Entity("tags")
export class Tag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @ManyToMany(() => Post, (post) => post.tags)
  posts!: Post[];
}

// Entity for testing OneToOne relations
@Entity("profiles")
export class Profile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  bio!: string;

  @Column({ unique: true })
  userId!: number;

  @OneToOne(() => User, (user: any) => user.profile, { onDelete: "CASCADE" })
  @JoinColumn()
  user!: any; // Use 'any' to avoid circular reference, decorator handles the type
}

// Entity for testing various column types
@Entity("test_columns")
export class TestColumns {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  intCol!: number;

  @Column({ type: "integer" })
  integerCol!: number;

  @Column({ type: "bigint" })
  bigintCol!: number;

  @Column({ type: "text" })
  textCol!: string;

  @Column({ type: "varchar", length: 255 })
  varcharCol!: string;

  @Column({ type: "real" })
  realCol!: number;

  @Column({ type: "float" })
  floatCol!: number;

  @Column({ type: "double" })
  doubleCol!: number;

  @Column({ type: "boolean" })
  booleanCol!: boolean;

  @Column({ type: "blob", nullable: true })
  blobCol?: Buffer;

  @Column({ type: "date", nullable: true })
  dateCol?: Date;

  @Column({ type: "datetime", nullable: true })
  datetimeCol?: Date;

  @Column({ type: "timestamp", nullable: true })
  timestampCol?: Date;

  @Column({ nullable: true })
  nullableCol?: string;

  @Column({ default: "default_value" })
  defaultCol!: string;
}

// Entity for testing constraints
@Entity("test_constraints")
export class TestConstraints {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  uniqueCol!: string;

  @Column({ nullable: false })
  notNullCol!: string;

  @Column({ default: 0 })
  defaultCol!: number;
}
