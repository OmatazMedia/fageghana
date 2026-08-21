<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable {
    use HasApiTokens, HasFactory, Notifiable;
    protected $table = 'users';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['name','email','password','avatar_url','phone'];
    protected $hidden = ['password','remember_token'];
    protected function casts(): array { return ['email_verified_at'=>'datetime','password'=>'hashed']; }
    protected static function boot() {
        parent::boot();
        static::creating(fn($m) => $m->id ??= \Illuminate\Support\Str::uuid()->toString());
    }
    public function roles() { return $this->hasMany(UserRole::class); }
    public function member() { return $this->hasOne(Member::class); }
    public function hasRole(string ...$roles): bool { return $this->roles->pluck('role')->intersect($roles)->isNotEmpty(); }
}
